import { describe, expect, it, vi } from 'vitest';
import { checkPaymentFraud } from '@/lib/payment-fraud-detection';

describe('checkPaymentFraud', () => {
  it('flagga transaction_id duplicado usado por outro utilizador', async () => {
    const neq = vi.fn().mockResolvedValue({
      data: [{ id: 'p1', user_id: 'user-2' }],
      error: null,
    });
    const eqTxn = vi.fn().mockReturnValue({ neq });
    const selectHistory = vi.fn().mockReturnValue({ eq: eqTxn });

    const eqPendingStatus = vi.fn().mockResolvedValue({ count: 0, error: null });
    const eqPendingUser = vi.fn().mockReturnValue({ eq: eqPendingStatus });
    const selectPending = vi.fn().mockReturnValue({ eq: eqPendingUser });

    const from = vi.fn((table: string) => {
      if (table !== 'payment_history') throw new Error('unexpected table');
      if (from.mock.calls.length === 1) return { select: selectHistory };
      return { select: selectPending };
    });

    const result = await checkPaymentFraud('user-1', 'TRX-001', { from });
    expect(result.flagged).toBe(true);
    expect(result.reasons).toContain('transaction_id já usado por outro utilizador');
  });

  it('não flagga quando não há sinais de fraude', async () => {
    const neq = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqTxn = vi.fn().mockReturnValue({ neq });
    const selectHistory = vi.fn().mockReturnValue({ eq: eqTxn });

    const eqPendingStatus = vi.fn().mockResolvedValue({ count: 1, error: null });
    const eqPendingUser = vi.fn().mockReturnValue({ eq: eqPendingStatus });
    const selectPending = vi.fn().mockReturnValue({ eq: eqPendingUser });

    const from = vi.fn((table: string) => {
      if (table !== 'payment_history') throw new Error('unexpected table');
      if (from.mock.calls.length === 1) return { select: selectHistory };
      return { select: selectPending };
    });

    const result = await checkPaymentFraud('user-1', 'TRX-ABC-123', { from });
    expect(result.flagged).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });
});
