const AUDIO_MAGIC_BYTES: Record<string, Array<number | null>> = {
  'audio/webm': [0x1a, 0x45, 0xdf, 0xa3],
  'audio/wav': [0x52, 0x49, 0x46, 0x46],
  'audio/x-wav': [0x52, 0x49, 0x46, 0x46],
  'audio/mpeg': [0xff, 0xfb],
  'audio/mp3': [0xff, 0xfb],
  'audio/mp4': [null, null, null, null, 0x66, 0x74, 0x79, 0x70],
  'audio/ogg': [0x4f, 0x67, 0x67, 0x53],
  'audio/flac': [0x66, 0x4c, 0x61, 0x43],
};

const MP3_ID3_MAGIC = [0x49, 0x44, 0x33];

export function validateAudioMagicBytes(
  buffer: Uint8Array,
  declaredMimeType: string,
): boolean {
  const magic = AUDIO_MAGIC_BYTES[declaredMimeType];

  if (!magic) return false;
  if (buffer.length < magic.length) return false;

  const matches = magic.every((byte, index) => byte === null || buffer[index] === byte);

  if (!matches && (declaredMimeType === 'audio/mpeg' || declaredMimeType === 'audio/mp3')) {
    return MP3_ID3_MAGIC.every((byte, index) => buffer[index] === byte);
  }

  return matches;
}
