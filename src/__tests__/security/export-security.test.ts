import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateDocx = vi.fn();
const mockEnforceRateLimit = vi.fn();
const mockGetUser = vi.fn();
const mockRequireFeatureAccess = vi.fn();
const mockPrepareMarkdownForExport = vi.fn();

vi.mock('@/lib/docx', () => ({ generateDocx: mockGenerateDocx }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: mockEnforceRateLimit }));
vi.mock('@/lib/api-auth', () => ({ requireFeatureAccess: mockRequireFeatureAccess }));
vi.mock('@/lib/docx/truncate-export', () => ({
  prepareMarkdownForExport: mockPrepareMarkdownForExport,
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

import { POST } from '@/app/api/export/route';

describe('Security — /api/export (R09 + R22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    mockGenerateDocx.mockResolvedValue(new ArrayBuffer(8));
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockRequireFeatureAccess.mockResolvedValue(null);
    mockPrepareMarkdownForExport.mockImplementation((content) => content);
  });

  it('rejeita payload com content superior a 500 KB', async () => {
    const req = new Request('http://localhost/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'x'.repeat(600_000) }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockGenerateDocx).not.toHaveBeenCalled();
  });

  it('sanitiza filename para evitar header injection', async () => {
    const req = new Request('http://localhost/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '# Test', filename: 'evil\r\nX-Injected: yes' }),
    });

    const res = await POST(req);
    const contentDisposition = res.headers.get('Content-Disposition') ?? '';

    expect(res.status).toBe(200);
    expect(contentDisposition).toContain('attachment; filename="evil.docx"');
    expect(contentDisposition).not.toContain('\r');
    expect(contentDisposition).not.toContain('\n');
    expect(contentDisposition).not.toContain('X-Injected');
  });

  it('retorna 401 quando utilizador não está autenticado', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const req = new Request('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify({ content: '# ok' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockGenerateDocx).not.toHaveBeenCalled();
  });

  it('valida acesso ao plano export_full antes de preparar o markdown', async () => {
    mockRequireFeatureAccess.mockResolvedValueOnce(
      Response.json({ error: 'Plano insuficiente para esta funcionalidade.' }, { status: 403 }),
    );

    const req = new Request('http://localhost/api/export', {
      method: 'POST',
      body: JSON.stringify({ content: '# Conteúdo completo' }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockRequireFeatureAccess).toHaveBeenCalledWith('u1', 'export_full');
    expect(mockPrepareMarkdownForExport).toHaveBeenCalledWith('# Conteúdo completo', false);
    expect(mockGenerateDocx).toHaveBeenCalledTimes(1);
  });

  it('retorna 429 quando rate limit é excedido', async () => {
    mockEnforceRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }),
    );

    const res = await POST(
      new Request('http://localhost/api/export', {
        method: 'POST',
        body: JSON.stringify({ content: '# ok' }),
      }),
    );

    expect(res.status).toBe(429);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockGenerateDocx).not.toHaveBeenCalled();
  });
});
