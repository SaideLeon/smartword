const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_MEDIA_TYPES = ['image/png', 'image/jpeg'] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export function validateBase64Image(
  base64: string,
  mediaType: SupportedMediaType,
): Buffer | null {
  try {
    if (!SUPPORTED_MEDIA_TYPES.includes(mediaType)) return null;

    // Aceita tanto "data:image/...;base64," como string base64 pura
    let rawBase64 = base64;
    const dataUrlPrefix = `data:${mediaType};base64,`;
    if (base64.startsWith('data:')) {
      if (!base64.startsWith(dataUrlPrefix)) return null;
      rawBase64 = base64.slice(dataUrlPrefix.length);
    }

    if (!rawBase64) return null;

    const buffer = Buffer.from(rawBase64, 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;

    return buffer;
  } catch {
    return null;
  }
}
