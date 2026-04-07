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

describe('Security suite — /api/transcribe (R07 tamanho áudio)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GROQ_API_KEY = 'test-key';
    mockEnforceRateLimit.mockResolvedValue(null);
    mockRequireAuth.mockResolvedValue({ user: { id: 'u1' }, error: null });
  });

  it('rejeita ficheiro acima de 25MB antes de chamar a API externa', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const tooLargeAudio = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'audio.webm', {
      type: 'audio/webm',
    });

    const form = new FormData();
    form.append('audio', tooLargeAudio);

    const req = new Request('http://localhost/api/transcribe', {
      method: 'POST',
      body: form,
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejeita MIME type não suportado', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const invalidMimeAudio = new File([new Uint8Array([1, 2, 3])], 'audio.bin', {
      type: 'application/octet-stream',
    });
    const form = new FormData();
    form.append('audio', invalidMimeAudio);

    const req = new Request('http://localhost/api/transcribe', {
      method: 'POST',
      body: form,
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
