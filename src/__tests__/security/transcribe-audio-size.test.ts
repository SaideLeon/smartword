import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/transcribe/route';

describe('Security suite — /api/transcribe (R07 tamanho áudio)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GROQ_API_KEY = 'test-key';
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
});
