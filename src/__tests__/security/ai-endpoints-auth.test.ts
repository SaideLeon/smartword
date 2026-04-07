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
import { POST as tccApprovePost } from '@/app/api/tcc/approve/route';
import { POST as tccDevelopPost } from '@/app/api/tcc/develop/route';
import { GET as tccCompressGet, POST as tccCompressPost } from '@/app/api/tcc/compress/route';
import { GET as tccSessionGet, DELETE as tccSessionDelete } from '@/app/api/tcc/session/route';
import { POST as workApprovePost } from '@/app/api/work/approve/route';
import { POST as workDevelopPost } from '@/app/api/work/develop/route';
import { POST as workGeneratePost } from '@/app/api/work/generate/route';
import { GET as workSessionGet, DELETE as workSessionDelete } from '@/app/api/work/session/route';
import { POST as transcribePost } from '@/app/api/transcribe/route';

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

  it('POST /api/tcc/approve retorna 401 sem autenticação', async () => {
    const req = new Request('http://localhost/api/tcc/approve', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'abc', outline: '## 1. Introdução' }),
    });
    const res = await tccApprovePost(req);
    expect(res.status).toBe(401);
  });

  it('POST /api/tcc/develop retorna 401 sem autenticação', async () => {
    const req = new Request('http://localhost/api/tcc/develop', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'abc', sectionIndex: 1 }),
    });
    const res = await tccDevelopPost(req);
    expect(res.status).toBe(401);
  });

  it('GET/POST /api/tcc/compress retornam 401 sem autenticação', async () => {
    const getRes = await tccCompressGet(new Request('http://localhost/api/tcc/compress?sessionId=abc'));
    const postRes = await tccCompressPost(new Request('http://localhost/api/tcc/compress', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'abc', targetSectionIndex: 1 }),
    }));
    expect(getRes.status).toBe(401);
    expect(postRes.status).toBe(401);
  });

  it('GET/DELETE /api/tcc/session retornam 401 sem autenticação', async () => {
    const getRes = await tccSessionGet(new Request('http://localhost/api/tcc/session?id=abc'));
    const deleteRes = await tccSessionDelete(new Request('http://localhost/api/tcc/session?id=abc', { method: 'DELETE' }));
    expect(getRes.status).toBe(401);
    expect(deleteRes.status).toBe(401);
  });

  it('POST /api/work/approve e /api/work/develop retornam 401 sem autenticação', async () => {
    const approveRes = await workApprovePost(new Request('http://localhost/api/work/approve', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'abc', outline: '## Introdução' }),
    }));
    const developRes = await workDevelopPost(new Request('http://localhost/api/work/develop', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'abc', sectionIndex: 1 }),
    }));
    expect(approveRes.status).toBe(401);
    expect(developRes.status).toBe(401);
  });

  it('GET/DELETE /api/work/session retornam 401 sem autenticação', async () => {
    const getRes = await workSessionGet(new Request('http://localhost/api/work/session?id=abc'));
    const deleteRes = await workSessionDelete(new Request('http://localhost/api/work/session?id=abc', { method: 'DELETE' }));
    expect(getRes.status).toBe(401);
    expect(deleteRes.status).toBe(401);
  });

  it('POST /api/transcribe retorna 401 sem autenticação', async () => {
    const form = new FormData();
    form.append('audio', new File([new Uint8Array([1, 2])], 'audio.webm', { type: 'audio/webm' }));

    const res = await transcribePost(new Request('http://localhost/api/transcribe', {
      method: 'POST',
      body: form,
    }));

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

  it('POST /api/tcc/develop retorna 403 quando plano não permite TCC', async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: 'u1' }, error: null });
    mockRequireFeatureAccess.mockResolvedValue(
      Response.json({ error: 'Plano insuficiente para esta funcionalidade.' }, { status: 403 }),
    );

    const req = new Request('http://localhost/api/tcc/develop', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'abc', sectionIndex: 1 }),
    });

    const res = await tccDevelopPost(req);

    expect(res.status).toBe(403);
    expect(mockRequireFeatureAccess).toHaveBeenCalledWith('u1', 'tcc');
  });

  it('POST /api/work/develop retorna 403 quando plano não permite criação de work', async () => {
    mockRequireAuth.mockResolvedValue({ user: { id: 'u1' }, error: null });
    mockRequireFeatureAccess.mockResolvedValue(
      Response.json({ error: 'Plano insuficiente para esta funcionalidade.' }, { status: 403 }),
    );

    const req = new Request('http://localhost/api/work/develop', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'abc', sectionIndex: 1 }),
    });

    const res = await workDevelopPost(req);

    expect(res.status).toBe(403);
    expect(mockRequireFeatureAccess).toHaveBeenCalledWith('u1', 'create_work');
  });
});
