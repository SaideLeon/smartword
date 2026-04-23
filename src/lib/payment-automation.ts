import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL não configurado');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function calculatePlanExpiry(durationMonths: number | null): string | null {
  if (!durationMonths || durationMonths <= 0) return null;
  const now = new Date();
  const expires = new Date(now);
  expires.setMonth(expires.getMonth() + durationMonths);
  return expires.toISOString();
}

export async function confirmPaymentAutomaticallyByTransactionId(params: {
  transactionId: string;
  notes: string;
}) {
  const supabase = getServiceSupabase();

  const { data: payment, error: paymentError } = await supabase
    .from('payment_history')
    .select('id, user_id, plan_key, status')
    .eq('transaction_id', params.transactionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) throw new Error(`Falha ao carregar pagamento: ${paymentError.message}`);
  if (!payment) return { ok: false as const, reason: 'not_found' as const };
  if (payment.status === 'confirmed') return { ok: true as const, alreadyConfirmed: true };
  if (payment.status !== 'pending') return { ok: false as const, reason: 'invalid_state' as const };

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('duration_months')
    .eq('key', payment.plan_key)
    .single();

  if (planError) throw new Error(`Falha ao carregar plano: ${planError.message}`);

  const confirmedAt = new Date().toISOString();
  const expiresAt = calculatePlanExpiry(plan?.duration_months ?? null);

  const { error: paymentUpdateError } = await supabase
    .from('payment_history')
    .update({
      status: 'confirmed',
      confirmed_at: confirmedAt,
      notes: params.notes.slice(0, 500),
      updated_at: confirmedAt,
    })
    .eq('id', payment.id)
    .eq('status', 'pending');

  if (paymentUpdateError) {
    throw new Error(`Falha ao confirmar payment_history: ${paymentUpdateError.message}`);
  }

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({
      plan_key: payment.plan_key,
      plan_expires_at: expiresAt,
      payment_status: 'active',
      payment_verified_at: confirmedAt,
      payment_verified_by: null,
      works_used: 0,
      edits_used: 0,
      updated_at: confirmedAt,
    })
    .eq('id', payment.user_id);

  if (profileUpdateError) {
    throw new Error(`Falha ao actualizar perfil após confirmação: ${profileUpdateError.message}`);
  }

  return { ok: true as const, alreadyConfirmed: false, paymentId: payment.id };
}

export async function markPaymentAsRejectedByTransactionId(params: { transactionId: string; notes: string }) {
  const supabase = getServiceSupabase();

  const { data: payment, error: paymentError } = await supabase
    .from('payment_history')
    .select('id, user_id, status')
    .eq('transaction_id', params.transactionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) throw new Error(`Falha ao carregar pagamento: ${paymentError.message}`);
  if (!payment || payment.status !== 'pending') return { ok: false as const };

  const now = new Date().toISOString();
  const { error: paymentUpdateError } = await supabase
    .from('payment_history')
    .update({
      status: 'rejected',
      confirmed_at: now,
      notes: params.notes.slice(0, 500),
      updated_at: now,
    })
    .eq('id', payment.id)
    .eq('status', 'pending');

  if (paymentUpdateError) throw new Error(`Falha ao rejeitar pagamento: ${paymentUpdateError.message}`);

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({
      payment_status: 'none',
      updated_at: now,
    })
    .eq('id', payment.user_id);

  if (profileUpdateError) throw new Error(`Falha ao atualizar perfil após rejeição: ${profileUpdateError.message}`);

  return { ok: true as const };
}
