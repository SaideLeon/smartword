type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string, options?: { count?: 'exact'; head?: boolean }) => any;
  };
};

export type FraudCheckResult = {
  flagged: boolean;
  reasons: string[];
};

export async function checkPaymentFraud(
  userId: string,
  transactionId: string,
  supabase: SupabaseLike,
): Promise<FraudCheckResult> {
  const reasons: string[] = [];
  const normalizedTxn = transactionId.trim();

  const { data: duplicateTransaction, error: duplicateError } = await supabase
    .from('payment_history')
    .select('id, user_id')
    .eq('transaction_id', normalizedTxn)
    .neq('user_id', userId);

  if (!duplicateError && Array.isArray(duplicateTransaction) && duplicateTransaction.length > 0) {
    reasons.push('transaction_id já usado por outro utilizador');
  }

  const { count: pendingPayments, error: pendingError } = await supabase
    .from('payment_history')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');

  if (!pendingError && (pendingPayments ?? 0) >= 3) {
    reasons.push('mais de 3 pagamentos pendentes simultâneos');
  }

  if (normalizedTxn.length < 6 || /^(.)\1{4,}$/i.test(normalizedTxn)) {
    reasons.push('transaction_id com padrão suspeito');
  }

  return { flagged: reasons.length > 0, reasons };
}
