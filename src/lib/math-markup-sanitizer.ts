const DANGEROUS_TAGS = /<\/?(script|iframe|object|embed|link|meta|style)\b[^>]*>/gi;
const INLINE_EVENT_HANDLER = /\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const JS_PROTOCOL_ATTR = /\s(href|src|xlink:href)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi;

/**
 * Sanitiza markup gerado pelo temml antes de usar dangerouslySetInnerHTML.
 * Remove tags activas, handlers inline e protocolos javascript:.
 */
export function sanitizeMathMarkup(markup: string): string {
  return markup
    .replace(DANGEROUS_TAGS, '')
    .replace(INLINE_EVENT_HANDLER, '')
    .replace(JS_PROTOCOL_ATTR, ' $1="#"');
}
