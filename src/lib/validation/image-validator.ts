const MAGIC_BYTES = {
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
} as const;

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function validateImageBuffer(
  buffer: Buffer,
  declaredMediaType: 'image/png' | 'image/jpeg',
): boolean {
  const expected = MAGIC_BYTES[declaredMediaType];
  if (!expected) return false;
  if (buffer.length < expected.length) return false;
  return expected.every((byte, index) => buffer[index] === byte);
}

export function validateBase64Image(
  base64: string,
  mediaType: 'image/png' | 'image/jpeg',
): Buffer | null {
  try {
    const rawBase64 = base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');

    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
    if (!validateImageBuffer(buffer, mediaType)) return null;

    return buffer;
  } catch {
    return null;
  }
}
