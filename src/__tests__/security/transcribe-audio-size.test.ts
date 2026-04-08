import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateAudioMagicBytes } from '@/lib/validation/audio-validator';

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

  it('rejeita ficheiro com magic bytes inválidos para o MIME declarado', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const fakeWebm = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00])], 'audio.webm', {
      type: 'audio/webm',
    });
    const form = new FormData();
    form.append('audio', fakeWebm);

    const req = new Request('http://localhost/api/transcribe', {
      method: 'POST',
      body: form,
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('aceita ficheiro com magic bytes válidos', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ text: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const validWebm = new File([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00])], 'audio.webm', {
      type: 'audio/webm',
    });
    const form = new FormData();
    form.append('audio', validWebm);

    const req = new Request('http://localhost/api/transcribe', {
      method: 'POST',
      body: form,
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('Security suite — validateAudioMagicBytes (R12)', () => {
  it('aceita WebM válido', () => {
    const webmHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
    expect(validateAudioMagicBytes(webmHeader, 'audio/webm')).toBe(true);
  });

  it('rejeita ZIP disfarçado de OGG', () => {
    const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
    expect(validateAudioMagicBytes(zipHeader, 'audio/ogg')).toBe(false);
  });

  it('aceita MP3 com ID3 tag', () => {
    const mp3Id3Header = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00]);
    expect(validateAudioMagicBytes(mp3Id3Header, 'audio/mpeg')).toBe(true);
  });
});
