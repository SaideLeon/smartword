import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnforceRateLimit = vi.fn();
const mockGeminiGenerateTextStreamSSE = vi.fn();
const mockSaveWorkOutlineDraft = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock('@/lib/gemini-resilient', () => ({
  geminiGenerateTextStreamSSE: mockGeminiGenerateTextStreamSSE,
}));

vi.mock('@/lib/work/service', () => ({
  saveWorkOutlineDraft: mockSaveWorkOutlineDraft,
}));

import { POST } from '@/app/api/work/generate/route';

describe('Security — /api/work/generate (R07b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceRateLimit.mockResolvedValue(null);
  });

  it('rejeita topic com mais de 500 caracteres', async () => {
    const req = new Request('http://localhost/api/work/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess-1',
        topic: 'T'.repeat(501),
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockGeminiGenerateTextStreamSSE).not.toHaveBeenCalled();
    expect(mockSaveWorkOutlineDraft).not.toHaveBeenCalled();
  });

  it('rejeita suggestions com mais de 2000 caracteres', async () => {
    const req = new Request('http://localhost/api/work/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess-1',
        topic: 'Tema válido',
        suggestions: 'S'.repeat(2001),
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockGeminiGenerateTextStreamSSE).not.toHaveBeenCalled();
    expect(mockSaveWorkOutlineDraft).not.toHaveBeenCalled();
  });
});
