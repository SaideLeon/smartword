import { describe, expect, it } from 'vitest';
import { validateBase64Image } from '@/lib/validation/image-validator';

describe('validateBase64Image', () => {
  it('aceita PNG com magic bytes válidos', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
    const pngBase64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    expect(validateBase64Image(pngBase64, 'image/png')).not.toBeNull();
  });

  it('rejeita SVG disfarçado de image/png', () => {
    const svgPayload = Buffer.from('<svg><script>alert(1)</script></svg>');
    const fakePng = `data:image/png;base64,${svgPayload.toString('base64')}`;
    expect(validateBase64Image(fakePng, 'image/png')).toBeNull();
  });

  it('rejeita JPEG declarado como image/png', () => {
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
});
