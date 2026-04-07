export function sanitizeExportFilename(input: unknown): string {
  if (typeof input !== 'string') return 'trabalho';

  const firstLineOnly = input.split(/[\r\n]+/, 1)[0] ?? '';
  const normalized = firstLineOnly
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\/\\?%*:|"<>;]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80);

  return normalized || 'trabalho';
}
