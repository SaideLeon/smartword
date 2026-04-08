import { describe, expect, it } from 'vitest';
import { validateBase64Image } from '@/lib/validation/image-validator';

describe('validateBase64Image', () => {
  it('aceita base64 em data URL PNG válido', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
    const pngBase64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    expect(validateBase64Image(pngBase64, 'image/png')).not.toBeNull();
  });

  it('aceita payload com conteúdo arbitrário quando data URL e MIME declarados são válidos', () => {
    const arbitraryPayload = Buffer.from('<svg><script>alert(1)</script></svg>');
    const asPngDataUrl = `data:image/png;base64,${arbitraryPayload.toString('base64')}`;
    expect(validateBase64Image(asPngDataUrl, 'image/png')).not.toBeNull();
  });

  it('rejeita prefixo data URL que não coincide com o MIME declarado', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00]);
    const jpegAsPng = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;
    expect(validateBase64Image(jpegAsPng, 'image/png')).toBeNull();
  });

  it('rejeita URL HTTP externa no lugar de base64', () => {
    expect(validateBase64Image('http://evil.example/logo.png', 'image/png')).toBeNull();
  });

  it('rejeita payload base64 sem prefixo data URL correto', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
    expect(validateBase64Image(pngBuffer.toString('base64'), 'image/png')).toBeNull();
  });

  it('rejeita imagem acima de 5 MB', () => {
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1, 1);
    const largeDataUrl = `data:image/png;base64,${largeBuffer.toString('base64')}`;
    expect(validateBase64Image(largeDataUrl, 'image/png')).toBeNull();
  });
});
