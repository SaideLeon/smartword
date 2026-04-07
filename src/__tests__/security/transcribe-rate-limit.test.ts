import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireAuth = vi.fn();
const mockEnforceRateLimit = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

import { POST } from '@/app/api/transcribe/route';

describe('Security — /api/transcribe (R06 rate limit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ user: { id: 'u1' }, error: null });
    mockEnforceRateLimit.mockResolvedValue(null);
  });

  it('retorna 429 quando o rate limit é excedido e não continua autenticação', async () => {
    mockEnforceRateLimit.mockResolvedValueOnce(
      Response.json({ error: 'Demasiados pedidos.' }, { status: 429 }),
    );

    const res = await POST(new Request('http://localhost/api/transcribe', { method: 'POST' }));

    expect(res.status).toBe(429);
    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        scope: 'transcribe:post',
        maxRequests: 5,
        windowMs: 60_000,
      }),
    );
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });
});
