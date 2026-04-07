export function sanitizeExportFilename(input: unknown): string {
  if (typeof input !== 'string') return 'trabalho';

  const normalized = input
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\/\\?%*:|"<>;\r\n]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80);

  return normalized || 'trabalho';
}
