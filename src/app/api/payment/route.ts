// src/app/api/payment/route.ts
// POST /api/payment — utilizador regista uma transação de pagamento
// PATCH /api/payment — admin confirma ou rejeita o pagamento

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';

const PAYMENT_METHODS = ['mpesa', 'emola', 'bank_transfer', 'card'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PaymentPostInput = {
  planKey: string;
  transactionId: string;
  paymentMethod: PaymentMethod;
  workSessionId: string | null;
};

function parsePaymentPostBody(body: unknown): PaymentPostInput | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Record<string, unknown>;

  if (typeof payload.plan_key !== 'string' || typeof payload.transaction_id !== 'string') return null;
  const planKey = payload.plan_key.trim();
  const transactionId = payload.transaction_id.trim();
  if (!planKey || planKey.length > 50) return null;
  if (transactionId.length < 3 || transactionId.length > 100) return null;
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
    transactionId,
    paymentMethod: payload.payment_method as PaymentMethod,
    workSessionId,
  };
}

type PaymentPatchInput = {
  paymentId: string;
  action: 'confirm' | 'reject';
  notes: string | null;
};

function parsePaymentPatchBody(body: unknown): PaymentPatchInput | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Record<string, unknown>;
  if (typeof payload.payment_id !== 'string' || !UUID_V4_PATTERN.test(payload.payment_id.trim())) return null;
  if (payload.action !== 'confirm' && payload.action !== 'reject') return null;

  let notes: string | null = null;
  if (payload.notes != null) {
    if (typeof payload.notes !== 'string') return null;
    const normalized = payload.notes.trim();
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
        get(name: string)                    { return cookieStore.get(name)?.value; },
        set(name: string, value: string, o: any) { cookieStore.set({ name, value, ...o }); },
        remove(name: string, o: any)         { cookieStore.delete({ name, ...o }); },
      },
    }
  );
}

// ── POST: utilizador submete comprovativo de pagamento ───────────────────────
export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'payment:post', maxRequests: 5, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const parsedBody = parsePaymentPostBody(await req.json());
    if (!parsedBody) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta ou inválidos' }, { status: 400 });
    }
    const { planKey, transactionId, paymentMethod, workSessionId } = parsedBody;

    if (workSessionId) {
      const { data: workSession, error: workSessionError } = await supabase
        .from('work_sessions')
        .select('id')
        .eq('id', workSessionId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (workSessionError || !workSession) {
        return NextResponse.json(
          { error: 'Sessão de trabalho inválida ou não autorizada' },
          { status: 403 },
        );
      }
    }

    const { data, error } = await supabase.rpc('register_payment', {
      p_user_id: user.id,
      p_plan_key: planKey,
      p_transaction_id: transactionId,
      p_payment_method: paymentMethod,
      p_work_session_id: workSessionId,
    });

    if (error?.code === '23505' || error?.code === 'P0003') {
      return NextResponse.json({ error: 'Transação já registada' }, { status: 409 });
    }

    if (error?.code === 'P0002') {
      return NextResponse.json({ error: 'Plano inválido ou inexistente' }, { status: 400 });
    }

    if (error?.code === 'P0001') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, payment_id: data.payment_id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── PATCH: admin confirma ou rejeita o pagamento ─────────────────────────────
export async function PATCH(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'payment:patch', maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  // Verificar role admin
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    const parsedBody = parsePaymentPatchBody(await req.json());
    if (!parsedBody) {
      return NextResponse.json({ error: 'payment_id e action são obrigatórios' }, { status: 400 });
    }
    const { paymentId, action, notes } = parsedBody;

    // Buscar o pagamento
    const { data: payment, error: fetchError } = await supabase
      .from('payment_history')
      .select('*, plans(*)')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }

    const newStatus = action === 'confirm' ? 'confirmed' : 'rejected';

    // Actualizar pagamento apenas se ainda estiver pendente (evita dupla confirmação)
    const { count, error: updateError } = await supabase
      .from('payment_history')
      .update({
        status:       newStatus,
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
        notes:        notes ?? null,
      }, { count: 'exact' })
      .eq('id', paymentId)
      .eq('status', 'pending');

    if (updateError) throw new Error(updateError.message);

    if (count === 0) {
      return NextResponse.json(
        { error: 'Pagamento já foi processado anteriormente', status: payment.status },
        { status: 409 },
      );
    }

    // Se confirmado: activar o plano no perfil do utilizador
    if (action === 'confirm') {
      const plan = payment.plans;
      const now = new Date();
      let expiresAt: string | null = null;

      if (plan.duration_months > 0) {
        const exp = new Date(now);
        exp.setMonth(exp.getMonth() + plan.duration_months);
        expiresAt = exp.toISOString();
      }

      await supabase
        .from('profiles')
        .update({
          plan_key:            payment.plan_key,
          plan_expires_at:     expiresAt,
          payment_status:      'active',
          payment_verified_at: now.toISOString(),
          payment_verified_by: user.id,
          works_used:          0,     // reset ao activar novo plano
          edits_used:          0,
        })
        .eq('id', payment.user_id);
    } else {
      // Rejeitado: voltar a 'none'
      await supabase
        .from('profiles')
        .update({ payment_status: 'none' })
        .eq('id', payment.user_id);
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── GET: listar pagamentos (admin vê todos, utilizador vê os seus) ───────────
export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'payment:get', maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('[payment GET] Sessão inválida:', userError?.message);
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('[payment GET] Erro ao ler perfil:', profileError.message);
  }

  const isAdmin = profile?.role === 'admin';

  if (isAdmin) {
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
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
      console.error('[payment GET] Falha ao registrar auditoria admin:', auditError.message);
      return NextResponse.json({ error: 'Falha ao registrar auditoria de acesso admin' }, { status: 500 });
    }
  }

  let paymentsQuery = supabase
    .from('payment_history')
    .select('id, user_id, created_at, plan_key, transaction_id, amount_mzn, payment_method, status, notes, confirmed_at')
    .order('created_at', { ascending: false });

  // Admin vê todos; utilizador comum só os seus
  if (!isAdmin) {
    paymentsQuery = paymentsQuery.eq('user_id', user.id);
  }

  const { data: payments, error: paymentsError } = await paymentsQuery;
  if (paymentsError) {
    console.error('[payment GET] Erro na query de pagamentos:', paymentsError.message, 'isAdmin:', isAdmin);
    return NextResponse.json({ error: paymentsError.message }, { status: 500 });
  }

  if (!payments || payments.length === 0) {
    return NextResponse.json([]);
  }

  const userIds = [...new Set(payments.map((payment) => payment.user_id))];
  const planKeys = [...new Set(payments.map((payment) => payment.plan_key))];

  const [profilesResult, plansResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds),
    supabase
      .from('plans')
      .select('key, label, price_mzn')
      .in('key', planKeys),
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
