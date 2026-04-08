import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockCreateServerClient = vi.fn();
const mockEnforceRateLimit = vi.fn();

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

import { PATCH, POST } from '@/app/api/admin/expenses/route';

describe('Security — /api/admin/expenses (R09 + R07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    mockCookies.mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    });
  });

  it('PATCH rejeita id malformado com 400', async () => {
    const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null });
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });
    const from = vi.fn((table: string) => {
      if (table === 'profiles') return { select: profileSelect };
      if (table === 'expense_items') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({ single: vi.fn() })),
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    mockCreateServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from,
    });

    const req = new Request('http://localhost/api/admin/expenses?id=../../etc/passwd', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'groq_api',
        description: 'Teste',
        amount_mzn: 100,
        period_month: 1,
        period_year: 2026,
      }),
    });

    const res = await PATCH(req);

    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalledWith('expense_items');
  });

  it('PATCH aceita UUID válido (não retorna erro de validação)', async () => {
    const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null });
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });
    const expenseSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'db-error' } });
    const expenseSelect = vi.fn().mockReturnValue({ single: expenseSingle });
    const expenseEq = vi.fn().mockReturnValue({ select: expenseSelect });
    const expenseUpdate = vi.fn().mockReturnValue({ eq: expenseEq });
    const from = vi.fn((table: string) => {
      if (table === 'profiles') return { select: profileSelect };
      if (table === 'expense_items') return { update: expenseUpdate };
      throw new Error(`unexpected table ${table}`);
    });

    mockCreateServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from,
    });

    const req = new Request(
      'http://localhost/api/admin/expenses?id=550e8400-e29b-41d4-a716-446655440000',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'groq_api',
          description: 'Teste',
          amount_mzn: 100,
          period_month: 1,
          period_year: 2026,
        }),
      },
    );

    const res = await PATCH(req);

    expect(res.status).not.toBe(400);
    expect(expenseUpdate).toHaveBeenCalled();
  });

  it('POST rejeita amount_mzn acima do limite', async () => {
    const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null });
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });
    const expenseInsert = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === 'profiles') return { select: profileSelect };
      if (table === 'expense_items') return { insert: expenseInsert };
      throw new Error(`unexpected table ${table}`);
    });

    mockCreateServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from,
    });

    const req = new Request('http://localhost/api/admin/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'groq_api',
        description: 'Teste',
        amount_mzn: 1_000_001,
        period_month: 1,
        period_year: 2026,
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(expenseInsert).not.toHaveBeenCalled();
  });

  it('POST aceita amount_mzn dentro do limite', async () => {
    const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null });
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });
    const expenseSingle = vi.fn().mockResolvedValue({ data: { id: 'e1' }, error: null });
    const expenseSelect = vi.fn().mockReturnValue({ single: expenseSingle });
    const expenseInsert = vi.fn().mockReturnValue({ select: expenseSelect });
    const from = vi.fn((table: string) => {
      if (table === 'profiles') return { select: profileSelect };
      if (table === 'expense_items') return { insert: expenseInsert };
      throw new Error(`unexpected table ${table}`);
    });

    mockCreateServerClient.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from,
    });

    const req = new Request('http://localhost/api/admin/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'groq_api',
        description: 'Teste',
        amount_mzn: 1_000_000,
        period_month: 1,
        period_year: 2026,
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(expenseInsert).toHaveBeenCalled();
  });
});
