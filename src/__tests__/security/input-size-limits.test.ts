import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnforceRateLimit = vi.fn();
const mockApproveOutline = vi.fn();
const mockApproveWorkOutline = vi.fn();
const mockGenerateResearchBrief = vi.fn();
const mockSaveTccResearchBrief = vi.fn();
const mockSaveContextType = vi.fn();
const mockDetectContextType = vi.fn();
const mockSaveWorkResearchBrief = vi.fn();
const mockRequireAuth = vi.fn();
const mockRequireFeatureAccess = vi.fn();
const mockCreateSession = vi.fn();
const mockCreateWorkSession = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock('@/lib/tcc/service', () => ({
  approveOutline: mockApproveOutline,
  saveTccResearchBrief: mockSaveTccResearchBrief,
  saveContextType: mockSaveContextType,
  createSession: mockCreateSession,
  getSession: vi.fn(),
  listSessions: vi.fn(),
  deleteSession: vi.fn(),
  markSectionInserted: vi.fn(),
  saveTccCoverData: vi.fn(),
}));

vi.mock('@/lib/work/service', () => ({
  approveWorkOutline: mockApproveWorkOutline,
  saveWorkResearchBrief: mockSaveWorkResearchBrief,
  createWorkSession: mockCreateWorkSession,
  deleteWorkSession: vi.fn(),
  getWorkSession: vi.fn(),
  listWorkSessions: vi.fn(),
  markWorkSectionInserted: vi.fn(),
  saveWorkCoverData: vi.fn(),
}));

vi.mock('@/lib/research/brief', () => ({
  generateResearchBrief: mockGenerateResearchBrief,
}));

vi.mock('@/lib/tcc/context-detector', () => ({
  detectContextType: mockDetectContextType,
}));

vi.mock('@/lib/api-auth', () => ({
  requireAuth: mockRequireAuth,
  requireFeatureAccess: mockRequireFeatureAccess,
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: 'ok', candidates: [{ content: { parts: [] } }] }),
    },
  })),
  Type: { OBJECT: 'object', STRING: 'string', ARRAY: 'array' },
}));

import { POST as tccApprovePost } from '@/app/api/tcc/approve/route';
import { POST as workApprovePost } from '@/app/api/work/approve/route';
import { POST as coverAgentPost } from '@/app/api/cover/agent/route';
import { POST as tccSessionPost } from '@/app/api/tcc/session/route';
import { POST as workSessionPost } from '@/app/api/work/session/route';

describe('Security suite — R07 limites de input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
    mockApproveOutline.mockResolvedValue({ id: 's1', topic: 'T' });
    mockApproveWorkOutline.mockResolvedValue({ id: 's2', topic: 'W' });
    mockGenerateResearchBrief.mockResolvedValue({ keywords: ['a'], brief: 'b' });
    mockDetectContextType.mockReturnValue('comparative');
    mockRequireAuth.mockResolvedValue({ user: { id: 'u1' }, error: null });
    mockRequireFeatureAccess.mockResolvedValue(null);
    mockCreateSession.mockResolvedValue({ id: 'tcc-1', topic: 'Tema válido' });
    mockCreateWorkSession.mockResolvedValue({ id: 'work-1', topic: 'Tema válido' });
  });

  it.each([
    ['tcc', tccSessionPost],
    ['work', workSessionPost],
  ])('rejeita topic < 3 em /api/%s/session', async (_scope, handler) => {
    const req = new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ topic: 'AB' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handler(req);

    expect(res.status).toBe(400);
  });

  it.each([
    ['tcc', tccSessionPost],
    ['work', workSessionPost],
  ])('rejeita topic > 500 em /api/%s/session', async (_scope, handler) => {
    const req = new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ topic: 'A'.repeat(501) }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handler(req);

    expect(res.status).toBe(400);
  });

  it.each([
    ['tcc', tccSessionPost],
    ['work', workSessionPost],
  ])('aceita topic válido em /api/%s/session', async (_scope, handler) => {
    const req = new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({ topic: 'Impacto da industrialização em Moçambique' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handler(req);

    expect(res.status).toBe(200);
  });

  it('rejeita outline > 15000 em /api/tcc/approve', async () => {
    const req = new Request('http://localhost/api/tcc/approve', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', outline: 'x'.repeat(15001) }),
    });

    const res = await tccApprovePost(req);

    expect(res.status).toBe(400);
    expect(mockApproveOutline).not.toHaveBeenCalled();
  });

  it('rejeita outline > 15000 em /api/work/approve', async () => {
    const req = new Request('http://localhost/api/work/approve', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', outline: 'x'.repeat(15001) }),
    });

    const res = await workApprovePost(req);

    expect(res.status).toBe(400);
    expect(mockApproveWorkOutline).not.toHaveBeenCalled();
  });

  it('rejeita messages acima de 30 em /api/cover/agent', async () => {
    const req = new Request('http://localhost/api/cover/agent', {
      method: 'POST',
      body: JSON.stringify({
        topic: 'Tema válido',
        outline: 'Outline válido',
        messages: Array.from({ length: 31 }, () => ({ role: 'user', content: 'ok' })),
      }),
    });

    const res = await coverAgentPost(req);

    expect(res.status).toBe(400);
  });

  it('rejeita topic acima de 500 em /api/cover/agent', async () => {
    const req = new Request('http://localhost/api/cover/agent', {
      method: 'POST',
      body: JSON.stringify({
        topic: 't'.repeat(501),
        outline: 'Outline válido',
        messages: [],
      }),
    });

    const res = await coverAgentPost(req);

    expect(res.status).toBe(400);
  });
});
