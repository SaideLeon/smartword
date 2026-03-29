// src/app/api/payment/route.ts
// POST /api/payment — utilizador regista uma transação de pagamento
// PATCH /api/payment — admin confirma ou rejeita o pagamento

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';

function makeSupabase() {
  const cookieStore = cookies();
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

  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const { plan_key, transaction_id, amount_mzn, payment_method, work_session_id } = await req.json();

    if (!plan_key || !transaction_id || !amount_mzn || !payment_method) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
    }

    // Verificar se o transaction_id já existe (evitar duplicados)
    const { data: existing } = await supabase
      .from('payment_history')
      .select('id')
      .eq('transaction_id', transaction_id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Transação já registada' }, { status: 409 });
    }

    // Inserir pagamento com status 'pending'
    const { data: payment, error } = await supabase
      .from('payment_history')
      .insert({
        user_id: user.id,
        plan_key,
        transaction_id,
        amount_mzn,
        payment_method,
        work_session_id: work_session_id ?? null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Actualizar perfil com transaction_id e status pending
    await supabase
      .from('profiles')
      .update({
        transaction_id,
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

  const supabase = makeSupabase();
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

    // Actualizar pagamento
    await supabase
      .from('payment_history')
      .update({
        status:       newStatus,
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
        notes:        notes ?? null,
      })
      .eq('id', payment_id);

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

  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  let query = supabase
    .from('payment_history')
    .select('*, profiles(email, full_name), plans(label, price_mzn)')
    .order('created_at', { ascending: false });

  // Admin vê todos; utilizador comum só os seus
  if (profile?.role !== 'admin') {
    query = query.eq('user_id', user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
