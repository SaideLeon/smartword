// src/app/api/payment/route.ts
// POST /api/payment — utilizador regista uma transação de pagamento
// PATCH /api/payment — admin confirma ou rejeita o pagamento

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';

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
  const limited = enforceRateLimit(req, { scope: 'payment:post', maxRequests: 5, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const { plan_key, transaction_id, payment_method, work_session_id } = await req.json();

    if (!plan_key || !transaction_id || !payment_method) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    const normalizedPlanKey = String(plan_key).trim();
    const normalizedTransactionId = String(transaction_id).trim();
    if (!normalizedPlanKey) {
      return NextResponse.json({ error: 'Plano inválido ou inexistente' }, { status: 400 });
    }

    // Segurança (R18): preço vem sempre do servidor e nunca do body do cliente.
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('key, price_mzn, is_active')
      .eq('key', normalizedPlanKey)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plano inválido ou inexistente' }, { status: 400 });
    }

    if (!plan.is_active) {
      return NextResponse.json({ error: 'Plano não disponível' }, { status: 400 });
    }

    // Inserção directa para evitar race condition entre SELECT+INSERT.
    // A constraint UNIQUE em payment_history.transaction_id garante atomicidade.
    const { data: payment, error } = await supabase
      .from('payment_history')
      .insert({
        user_id: user.id,
        plan_key: normalizedPlanKey,
        transaction_id: normalizedTransactionId,
        amount_mzn: plan.price_mzn,
        payment_method,
        work_session_id: work_session_id ?? null,
        status: 'pending',
      })
      .select()
      .single();

    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Transação já registada' }, { status: 409 });
    }

    if (error) throw new Error(error.message);

    // Actualizar perfil com transaction_id e status pending
    await supabase
      .from('profiles')
      .update({
        transaction_id: normalizedTransactionId,
        payment_method,
        payment_status: 'pending',
      })
      .eq('id', user.id);

    return NextResponse.json({ ok: true, payment_id: payment.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── PATCH: admin confirma ou rejeita o pagamento ─────────────────────────────
export async function PATCH(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'payment:patch', maxRequests: 30, windowMs: 60_000 });
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
    const { payment_id, action, notes } = await req.json();
    // action: 'confirm' | 'reject'

    if (!payment_id || !action) {
      return NextResponse.json({ error: 'payment_id e action são obrigatórios' }, { status: 400 });
    }

    // Buscar o pagamento
    const { data: payment, error: fetchError } = await supabase
      .from('payment_history')
      .select('*, plans(*)')
      .eq('id', payment_id)
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
      .eq('id', payment_id)
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
  const limited = enforceRateLimit(req, { scope: 'payment:get', maxRequests: 30, windowMs: 60_000 });
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
