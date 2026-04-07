import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnforceRateLimit = vi.fn();
const mockRequireAuth = vi.fn();
const mockRequireFeatureAccess = vi.fn();
const mockGeminiGenerateTextStreamSSE = vi.fn();
const mockGenerateDocxWithCover = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock('@/lib/api-auth', () => ({
  requireAuth: mockRequireAuth,
  requireFeatureAccess: mockRequireFeatureAccess,
}));

vi.mock('@/lib/gemini-resilient', () => ({
  geminiGenerateTextStreamSSE: mockGeminiGenerateTextStreamSSE,
}));

vi.mock('@/lib/docx', () => ({
  generateDocxWithCover: mockGenerateDocxWithCover,
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: 'ok', candidates: [{ content: { parts: [] } }] }),
    },
  })),
  Type: { OBJECT: 'object', STRING: 'string', ARRAY: 'array' },
}));

import { POST as chatPost } from '@/app/api/chat/route';
import { POST as coverExportPost } from '@/app/api/cover/export/route';
import { POST as coverAbstractPost } from '@/app/api/cover/abstract/route';
import { POST as coverAgentPost } from '@/app/api/cover/agent/route';
import { POST as tccOutlinePost } from '@/app/api/tcc/outline/route';
import { POST as workGeneratePost } from '@/app/api/work/generate/route';

describe('Security suite — R22/R16 auth em endpoints de IA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    mockRequireAuth.mockResolvedValue({
      user: null,
      error: Response.json({ error: 'Não autenticado' }, { status: 401 }),
    });
    mockRequireFeatureAccess.mockResolvedValue(null);
    mockGeminiGenerateTextStreamSSE.mockResolvedValue(new ReadableStream());
    mockGenerateDocxWithCover.mockResolvedValue(new ArrayBuffer(16));
  });

  it('POST /api/chat retorna 401 sem autenticação', async () => {
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Olá' }] }),
    });

    const res = await chatPost(req);

    expect(res.status).toBe(401);
    expect(mockRequireFeatureAccess).not.toHaveBeenCalled();
  });

  it('POST /api/cover/export retorna 401 sem autenticação', async () => {
    const req = new Request('http://localhost/api/cover/export', {
      method: 'POST',
      body: JSON.stringify({ coverData: { institution: 'X' }, markdown: '# Test' }),
    });

    const res = await coverExportPost(req);

    expect(res.status).toBe(401);
    expect(mockRequireFeatureAccess).not.toHaveBeenCalled();
  });

  it('POST /api/cover/abstract retorna 401 sem autenticação', async () => {
    const req = new Request('http://localhost/api/cover/abstract', {
      method: 'POST',
      body: JSON.stringify({ theme: 'Impacto das TIC na Educação' }),
    });

    const res = await coverAbstractPost(req);

    expect(res.status).toBe(401);
    expect(mockRequireFeatureAccess).not.toHaveBeenCalled();
  });

  it('POST /api/cover/agent retorna 401 sem autenticação', async () => {
    const req = new Request('http://localhost/api/cover/agent', {
      method: 'POST',
      body: JSON.stringify({ topic: 'Energia solar', outline: 'outline', messages: [] }),
    });

    const res = await coverAgentPost(req);

    expect(res.status).toBe(401);
    expect(mockRequireFeatureAccess).not.toHaveBeenCalled();
  });

  it('POST /api/tcc/outline retorna 401 sem autenticação', async () => {
    const req = new Request('http://localhost/api/tcc/outline', {
      method: 'POST',
      body: JSON.stringify({ topic: 'Tema de TCC', sessionId: 'abc' }),
    });

    const res = await tccOutlinePost(req);

    expect(res.status).toBe(401);
  });

  it('POST /api/work/generate retorna 401 sem autenticação', async () => {
    const req = new Request('http://localhost/api/work/generate', {
      method: 'POST',
      body: JSON.stringify({ topic: 'Tema escolar', sessionId: 'abc' }),
    });

    const res = await workGeneratePost(req);

    expect(res.status).toBe(401);
  });

  it('retorna 403 quando o plano não permite feature paga', async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: 'u1' }, error: null });
    mockRequireFeatureAccess.mockResolvedValue(
      Response.json({ error: 'Plano insuficiente para esta funcionalidade.' }, { status: 403 }),
    );

    const req = new Request('http://localhost/api/cover/export', {
      method: 'POST',
      body: JSON.stringify({ coverData: { institution: 'X' }, markdown: '# Test' }),
    });

    const res = await coverExportPost(req);

    expect(res.status).toBe(403);
    expect(mockRequireFeatureAccess).toHaveBeenCalledWith('u1', 'cover');
  });
});
