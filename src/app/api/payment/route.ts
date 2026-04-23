// src/app/api/payment/route.ts
// POST /api/payment — cria automaticamente um pedido na PaySuite
// PATCH /api/payment — fallback admin para confirmação/rejeição manual

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';
import { checkPaymentFraud } from '@/lib/payment-fraud-detection';
import {
  createPaySuitePaymentRequest,
  generatePaySuiteReference,
  getPaySuitePaymentStatus,
  isPaySuitePaidStatus,
  type PaySuiteMethod,
} from '@/lib/paysuite';
import { confirmPaymentAutomaticallyByTransactionId } from '@/lib/payment-automation';

const PAYMENT_METHODS = ['mpesa', 'emola', 'card'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PaymentPostInput = {
  planKey: string;
  paymentMethod: PaymentMethod;
  workSessionId: string | null;
};

function toPaySuiteMethod(method: PaymentMethod): PaySuiteMethod {
  if (method === 'card') return 'credit_card';
  return method;
}

function parsePaymentPostBody(body: unknown): PaymentPostInput | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Record<string, unknown>;

  if (typeof payload.plan_key !== 'string') return null;
  const planKey = payload.plan_key.trim();
  if (!planKey || planKey.length > 50) return null;
  if (!PAYMENT_METHODS.includes(payload.payment_method as PaymentMethod)) return null;

  let workSessionId: string | null = null;
  if (payload.work_session_id != null) {
    if (typeof payload.work_session_id !== 'string') return null;
    const normalized = payload.work_session_id.trim();
    if (!UUID_V4_PATTERN.test(normalized)) return null;
    workSessionId = normalized;
  }

  return {
    planKey,
    paymentMethod: payload.payment_method as PaymentMethod,
    workSessionId,
  };
}

type PaymentPatchInput = {
  paymentId: string;
  action: 'confirm' | 'reject';
  notes: string | null;
};

const PAYMENT_ATTEMPT_COOLDOWN_SECONDS = 300;

function sanitizeNotes(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[<>"'`]/g, '')
    .replace(/[^a-zA-Z0-9\s.,;:!?()[\]{}\-_@#/áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '')
    .replace(/\b(?:javascript|vbscript|data|script|on\w+|alert)\b[:=]?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function parsePaymentPatchBody(body: unknown): PaymentPatchInput | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Record<string, unknown>;
  if (typeof payload.payment_id !== 'string' || !UUID_V4_PATTERN.test(payload.payment_id.trim())) return null;
  if (payload.action !== 'confirm' && payload.action !== 'reject') return null;

  let notes: string | null = null;
  if (payload.notes != null) {
    if (typeof payload.notes !== 'string') return null;
    const normalized = sanitizeNotes(payload.notes);
    if (normalized.length > 500) return null;
    notes = normalized || null;
  }

  return { paymentId: payload.payment_id.trim(), action: payload.action, notes };
}

async function makeSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, o: any) {
          cookieStore.set({ name, value, ...o });
        },
        remove(name: string, o: any) {
          cookieStore.delete({ name, ...o });
        },
      },
    },
  );
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'payment:post', maxRequests: 5, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const parsedBody = parsePaymentPostBody(await req.json());
    if (!parsedBody) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta ou inválidos' }, { status: 400 });
    }
    const { planKey, paymentMethod, workSessionId } = parsedBody;

    if (workSessionId) {
      const { data: workSession, error: workSessionError } = await supabase
        .from('work_sessions')
        .select('id')
        .eq('id', workSessionId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (workSessionError || !workSession) {
        return NextResponse.json({ error: 'Sessão de trabalho inválida ou não autorizada' }, { status: 403 });
      }
    }

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('key, label, price_mzn')
      .eq('key', planKey)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plano inválido ou inexistente' }, { status: 400 });
    }

    const planAmountMzn = Number(plan.price_mzn);
    if (!Number.isFinite(planAmountMzn) || planAmountMzn < 1) {
      return NextResponse.json(
        { error: 'Este plano não requer pagamento via PaySuite.' },
        { status: 400 },
      );
    }

    const reference = generatePaySuiteReference(plan.key, user.id);
    const appUrl = process.env.APP_URL?.trim() || new URL(req.url).origin;
    const callbackUrl = `${appUrl}/api/payment/webhook`;
    const returnUrl = `${appUrl}/planos?payment_reference=${encodeURIComponent(reference)}`;

    const paySuitePayment = await createPaySuitePaymentRequest({
      amountMzn: planAmountMzn,
      reference,
      description: `Muneri - Plano ${plan.label} - ${plan.key}`,
      method: toPaySuiteMethod(paymentMethod),
      callbackUrl,
      returnUrl,
    });

    const fraudCheck = await checkPaymentFraud(user.id, paySuitePayment.id, supabase);
    if (fraudCheck.flagged) {
      const { error: fraudAuditError } = await supabase.rpc('log_fraud_event', {
        p_actor_id: user.id,
        p_transaction_id: paySuitePayment.id,
        p_reasons: fraudCheck.reasons,
      });

      if (fraudAuditError) {
        return NextResponse.json({ error: 'Erro interno de segurança' }, { status: 500 });
      }

      return NextResponse.json(
        {
          error: 'PAYMENT_ATTEMPT_LIMIT',
          message:
            'Detectamos várias tentativas de criar pagamento sem conclusão. Por segurança, bloqueámos novas solicitações temporariamente.',
          retry_after: PAYMENT_ATTEMPT_COOLDOWN_SECONDS,
          guidance: [
            'Finalize o pagamento já iniciado',
            'Atualize a página',
            'Aguarde alguns minutos antes de tentar novamente',
          ],
        },
        { status: 409 },
      );
    }

    const { data, error } = await supabase.rpc('register_payment', {
      p_user_id: user.id,
      p_plan_key: plan.key,
      p_transaction_id: paySuitePayment.id,
      p_payment_method: paymentMethod,
      p_work_session_id: workSessionId,
    });

    if (error?.code === '23505' || error?.code === 'P0003') {
      return NextResponse.json(
        {
          error: 'PAYMENT_ALREADY_REGISTERED',
          message: 'Já existe um pagamento em processamento para esta tentativa.',
          guidance: ['Atualize a página e continue com o checkout aberto', 'Aguarde alguns minutos e tente novamente'],
        },
        { status: 409 },
      );
    }

    if (error?.code === 'P0002') {
      return NextResponse.json({ error: 'Plano inválido ou inexistente' }, { status: 400 });
    }

    if (error?.code === 'P0001') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      payment_id: data.payment_id,
      provider_payment_id: paySuitePayment.id,
      provider_reference: paySuitePayment.reference,
      provider_status: paySuitePayment.status,
      checkout_url: paySuitePayment.checkoutUrl,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'payment:patch', maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    const parsedBody = parsePaymentPatchBody(await req.json());
    if (!parsedBody) {
      return NextResponse.json({ error: 'payment_id e action são obrigatórios' }, { status: 400 });
    }
    const { paymentId, action, notes } = parsedBody;
    const { data, error } = await supabase.rpc('confirm_payment', {
      p_payment_id: paymentId,
      p_admin_id: user.id,
      p_action: action,
      p_notes: notes ?? null,
    });

    if (error?.code === 'P0004') {
      return NextResponse.json({ error: 'Pagamento já foi processado anteriormente' }, { status: 409 });
    }
    if (error?.code === 'P0003') {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }
    if (error?.code === 'P0002') {
      return NextResponse.json({ error: 'Acção inválida' }, { status: 400 });
    }
    if (error?.code === 'P0001') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, status: data?.status ?? (action === 'confirm' ? 'confirmed' : 'rejected') });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'payment:get', maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';

  if (isAdmin) {
    const { error: auditError } = await supabase.from('audit_log').insert({
      actor_id: user.id,
      action: 'admin_list_payments',
      resource: 'payment_history',
      metadata: {
        endpoint: '/api/payment',
        method: 'GET',
        queried_at: new Date().toISOString(),
      },
    });

    if (auditError) {
      return NextResponse.json(
        { error: 'Falha no registo de auditoria. Operação bloqueada por segurança.' },
        { status: 500 },
      );
    }
  }

  let paymentsQuery = supabase
    .from('payment_history')
    .select('id, user_id, created_at, plan_key, transaction_id, amount_mzn, payment_method, status, notes, confirmed_at')
    .order('created_at', { ascending: false });

  if (!isAdmin) {
    paymentsQuery = paymentsQuery.eq('user_id', user.id);
  }

  const { data: payments, error: paymentsError } = await paymentsQuery;
  if (paymentsError) {
    return NextResponse.json({ error: paymentsError.message }, { status: 500 });
  }

  if (!payments || payments.length === 0) {
    return NextResponse.json([]);
  }

  const paymentReferenceToSync = new URL(req.url).searchParams.get('sync_provider_payment_id')?.trim();
  if (paymentReferenceToSync) {
    const targetPayment = payments.find((p) => p.transaction_id === paymentReferenceToSync && p.status === 'pending');
    if (targetPayment) {
      try {
        const providerStatus = await getPaySuitePaymentStatus(paymentReferenceToSync);
        if (isPaySuitePaidStatus(providerStatus.status, providerStatus.transactionStatus)) {
          await confirmPaymentAutomaticallyByTransactionId({
            transactionId: paymentReferenceToSync,
            notes: 'Confirmado por polling de estado PaySuite',
          });
        }
      } catch (syncError) {
        console.warn('[payment GET] sync pay suite falhou:', syncError);
      }
    }
  }

  const userIds = [...new Set(payments.map((payment) => payment.user_id))];
  const planKeys = [...new Set(payments.map((payment) => payment.plan_key))];

  const [profilesResult, plansResult] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name').in('id', userIds),
    supabase.from('plans').select('key, label, price_mzn').in('key', planKeys),
  ]);

  const profilesMap = Object.fromEntries((profilesResult.data ?? []).map((profileItem) => [profileItem.id, profileItem]));
  const plansMap = Object.fromEntries((plansResult.data ?? []).map((plan) => [plan.key, plan]));

  const enriched = payments.map((payment) => ({
    ...payment,
    profiles: profilesMap[payment.user_id] ?? null,
    plans: plansMap[payment.plan_key] ?? null,
  }));

  return NextResponse.json(enriched);
}
