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

import { PATCH, POST } from '@/app/api/payment/route';

type MockSupabase = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
  rpc?: ReturnType<typeof vi.fn>;
};

function makeReq(url: string, init?: RequestInit) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('Security suite — /api/payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    });
    mockEnforceRateLimit.mockReturnValue(null);
  });

  it('POST sem autenticação retorna 401', async () => {
    const supabase: MockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    mockCreateServerClient.mockReturnValue(supabase);

    const res = await POST(makeReq('http://localhost/api/payment', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('PATCH por utilizador não-admin retorna 403', async () => {
    const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'user' } });
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

    const supabase: MockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return { select: profileSelect };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    mockCreateServerClient.mockReturnValue(supabase);

    const res = await PATCH(
      makeReq('http://localhost/api/payment', {
        method: 'PATCH',
        body: JSON.stringify({ payment_id: 'payment-1', action: 'confirm' }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it('POST ignora amount_mzn enviado pelo cliente e usa price_mzn do plano', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { payment_id: 'payment-1', amount_mzn: 640 },
      error: null,
    });

    const supabase: MockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn(),
      rpc,
    };
    mockCreateServerClient.mockReturnValue(supabase);

    const res = await POST(
      makeReq('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify({
          plan_key: 'premium',
          transaction_id: 'TRX-123',
          amount_mzn: 1,
          payment_method: 'mpesa',
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'register_payment',
      expect.objectContaining({
        p_plan_key: 'premium',
        p_transaction_id: 'TRX-123',
      }),
    );
  });

  it('POST com plan_key inválido retorna 400', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0002', message: 'Plano inválido ou inactivo' },
    });

    const supabase: MockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn(),
      rpc,
    };
    mockCreateServerClient.mockReturnValue(supabase);

    const res = await POST(
      makeReq('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify({
          plan_key: 'invalid',
          transaction_id: 'TRX-124',
          payment_method: 'mpesa',
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST respeita rate limit e retorna 429', async () => {
    mockEnforceRateLimit.mockReturnValueOnce(
      new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
    );
    const res = await POST(makeReq('http://localhost/api/payment', { method: 'POST' }));
    expect(res.status).toBe(429);
  });
});
