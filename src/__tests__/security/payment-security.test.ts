import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockCreateServerClient = vi.fn();
const mockEnforceRateLimit = vi.fn();
const mockCheckPaymentFraud = vi.fn();

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock('@/lib/payment-fraud-detection', () => ({
  checkPaymentFraud: mockCheckPaymentFraud,
}));

import { GET, PATCH, POST } from '@/app/api/payment/route';

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
    mockCheckPaymentFraud.mockResolvedValue({ flagged: false, reasons: [] });
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

  it('POST rejeita transaction_id com mais de 100 caracteres (R07)', async () => {
    const rpc = vi.fn();
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
          transaction_id: 'A'.repeat(101),
          payment_method: 'mpesa',
        }),
      }),
    );

    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('POST rejeita work_session_id sem ownership (R18)', async () => {
    const workSessionMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const workSessionEqUser = vi.fn().mockReturnValue({ maybeSingle: workSessionMaybeSingle });
    const workSessionEqId = vi.fn().mockReturnValue({ eq: workSessionEqUser });
    const workSessionSelect = vi.fn().mockReturnValue({ eq: workSessionEqId });
    const rpc = vi.fn();

    const supabase: MockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'work_sessions') return { select: workSessionSelect };
        throw new Error(`unexpected table ${table}`);
      }),
      rpc,
    };
    mockCreateServerClient.mockReturnValue(supabase);

    const res = await POST(
      makeReq('http://localhost/api/payment', {
        method: 'POST',
        body: JSON.stringify({
          plan_key: 'premium',
          transaction_id: 'TRX-OWN-1',
          payment_method: 'mpesa',
          work_session_id: 'd6f5c2a1-b8e1-4e7d-9c7e-5ae2de5f1b9c',
        }),
      }),
    );

    expect(res.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('POST respeita rate limit e retorna 429', async () => {
    mockEnforceRateLimit.mockReturnValueOnce(
      new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
    );
    const res = await POST(makeReq('http://localhost/api/payment', { method: 'POST' }));
    expect(res.status).toBe(429);
  });

  it('POST com payment_method inválido retorna 400 (R23)', async () => {
    const rpc = vi.fn();
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
          plan_key: 'basico',
          transaction_id: 'TRX-001',
          payment_method: 'bitcoin',
        }),
      }),
    );

    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('PATCH em pagamento já processado retorna 409 (R23)', async () => {
    const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' } });
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0004', message: 'Pagamento já foi processado' },
    });

    const supabase: MockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') return { select: profileSelect };
        throw new Error(`unexpected table ${table}`);
      }),
      rpc,
    };
    mockCreateServerClient.mockReturnValue(supabase);

    const res = await PATCH(
      makeReq('http://localhost/api/payment', {
        method: 'PATCH',
        body: JSON.stringify({
          payment_id: '2b59e44a-e319-48b4-a63f-36350ea7fc77',
          action: 'confirm',
        }),
      }),
    );

    expect(res.status).toBe(409);
  });

  it('PATCH sanitiza notes antes de enviar para RPC (R18)', async () => {
    const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' } });
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, status: 'confirmed' }, error: null });

    const supabase: MockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') return { select: profileSelect };
        throw new Error(`unexpected table ${table}`);
      }),
      rpc,
    };
    mockCreateServerClient.mockReturnValue(supabase);

    const res = await PATCH(
      makeReq('http://localhost/api/payment', {
        method: 'PATCH',
        body: JSON.stringify({
          payment_id: '2b59e44a-e319-48b4-a63f-36350ea7fc77',
          action: 'confirm',
          notes: '<img src=x onerror=alert(1)> javascript:teste ok',
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('confirm_payment', expect.objectContaining({
      p_notes: expect.stringContaining('teste ok'),
    }));
    const sentNotes = rpc.mock.calls[0]?.[1]?.p_notes ?? '';
    expect(sentNotes).not.toMatch(/javascript|script|onerror|<|>/i);
  });



  it('PATCH bloqueia payloads de bypass em notes (R11)', async () => {
    const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' } });
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true, status: 'confirmed' }, error: null });

    const supabase: MockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') return { select: profileSelect };
        throw new Error(`unexpected table ${table}`);
      }),
      rpc,
    };
    mockCreateServerClient.mockReturnValue(supabase);

    const res = await PATCH(
      makeReq('http://localhost/api/payment', {
        method: 'PATCH',
        body: JSON.stringify({
          payment_id: '2b59e44a-e319-48b4-a63f-36350ea7fc77',
          action: 'confirm',
          notes: '<scr<script>ipt>alert(1)</script> java\u200bscript: &#106;avascript: ok',
        }),
      }),
    );

    expect(res.status).toBe(200);
    const sentNotes = rpc.mock.calls[0]?.[1]?.p_notes ?? '';
    expect(sentNotes).not.toMatch(/javascript|script|alert|<|>/i);
  });

  it('POST com fraude potencial regista via RPC e bloqueia pagamento (R21)', async () => {
    mockCheckPaymentFraud.mockResolvedValueOnce({
      flagged: true,
      reasons: ['transaction_id já usado por outro utilizador'],
    });

    const rpc = vi.fn((fnName: string) => {
      if (fnName === 'log_fraud_event') return Promise.resolve({ data: null, error: null });
      if (fnName === 'register_payment') return Promise.resolve({ data: { payment_id: 'payment-1' }, error: null });
      return Promise.resolve({ data: null, error: null });
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
          payment_method: 'mpesa',
        }),
      }),
    );

    expect(res.status).toBe(409);
    expect(rpc).toHaveBeenCalledWith('log_fraud_event', expect.objectContaining({
      p_actor_id: 'user-1',
      p_transaction_id: 'TRX-123',
    }));
    expect(rpc).not.toHaveBeenCalledWith('register_payment', expect.anything());
  });

  it('POST com fraude e falha no log retorna 500 (R21)', async () => {
    mockCheckPaymentFraud.mockResolvedValueOnce({
      flagged: true,
      reasons: ['suspeita'],
    });

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'insert failed' },
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
          transaction_id: 'TRX-999',
          payment_method: 'mpesa',
        }),
      }),
    );

    expect(res.status).toBe(500);
    expect(rpc).toHaveBeenCalledWith('log_fraud_event', expect.anything());
  });

  it('GET admin sem auditoria persistida retorna 500 (R16)', async () => {
    const profileSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null });
    const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
    const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

    const auditInsert = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } });

    const supabase: MockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') return { select: profileSelect };
        if (table === 'audit_log') return { insert: auditInsert };
        throw new Error(`unexpected table ${table}`);
      }),
    };
    mockCreateServerClient.mockReturnValue(supabase);

    const res = await GET(makeReq('http://localhost/api/payment', { method: 'GET' }));
    expect(res.status).toBe(500);
    expect(auditInsert).toHaveBeenCalledTimes(1);
  });
});
