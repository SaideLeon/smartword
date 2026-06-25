import AdmZip from 'adm-zip';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function attr(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`w:${name}="([^"]+)"`));
  return match?.[1] ?? null;
}

function runStyle(runXml: string): string {
  const styles: string[] = [];
  const color = runXml.match(/<w:color[^>]*w:val="([^"]+)"/)?.[1];
  const size = runXml.match(/<w:sz[^>]*w:val="(\d+)"/)?.[1];

  if (runXml.includes('<w:b') && !runXml.includes('w:val="0"')) styles.push('font-weight:700');
  if (runXml.includes('<w:i') && !runXml.includes('w:val="0"')) styles.push('font-style:italic');
  if (runXml.includes('<w:u') && !runXml.includes('w:val="none"')) styles.push('text-decoration:underline');
  if (color && color !== 'auto') styles.push(`color:#${color}`);
  if (size) styles.push(`font-size:${Number(size) / 2}pt`);

  return styles.length ? ` style="${styles.join(';')}"` : '';
}

function renderRuns(xml: string): string {
  const runs = xml.match(/<w:r[\s\S]*?<\/w:r>/g) ?? [];
  if (!runs.length) {
    const text = [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map(match => decodeXml(match[1]))
      .join('');
    return escapeHtml(text);
  }

  return runs.map(run => {
    const text = [...run.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map(match => decodeXml(match[1]))
      .join('');
    const breaks = (run.match(/<w:br\b/g) ?? []).map(() => '<br />').join('');
    if (!text && !breaks) return '';
    return `${breaks}<span${runStyle(run)}>${escapeHtml(text)}</span>`;
  }).join('');
}

function paragraphStyle(paragraphXml: string): string {
  const styles: string[] = [];
  const justification = paragraphXml.match(/<w:jc[^>]*w:val="([^"]+)"/)?.[1];
  const spacingAfter = paragraphXml.match(/<w:spacing[^>]*w:after="(\d+)"/)?.[1];
  const spacingBefore = paragraphXml.match(/<w:spacing[^>]*w:before="(\d+)"/)?.[1];

  if (justification) styles.push(`text-align:${justification === 'both' ? 'justify' : justification}`);
  if (spacingAfter) styles.push(`margin-bottom:${Number(spacingAfter) / 20}pt`);
  if (spacingBefore) styles.push(`margin-top:${Number(spacingBefore) / 20}pt`);

  return styles.length ? ` style="${styles.join(';')}"` : '';
}

function renderParagraph(paragraphXml: string): string {
  const content = renderRuns(paragraphXml).trim() || '&nbsp;';
  return `<p${paragraphStyle(paragraphXml)}>${content}</p>`;
}

function renderTable(tableXml: string): string {
  const rows = tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) ?? [];
  const renderedRows = rows.map(row => {
    const cells = row.match(/<w:tc[\s\S]*?<\/w:tc>/g) ?? [];
    return `<tr>${cells.map(cell => {
      const width = cell.match(/<w:tcW[^>]*w:w="(\d+)"/)?.[1];
      const style = width ? ` style="width:${Number(width) / 20}pt"` : '';
      const blocks = renderBlocks(cell.replace(/<w:tcPr[\s\S]*?<\/w:tcPr>/g, ''));
      return `<td${style}>${blocks || '&nbsp;'}</td>`;
    }).join('')}</tr>`;
  }).join('');

  return `<table>${renderedRows}</table>`;
}

function renderBlocks(xml: string): string {
  const blocks = xml.match(/<w:(?:p|tbl)\b[\s\S]*?<\/w:(?:p|tbl)>/g) ?? [];
  return blocks.map(block => block.startsWith('<w:tbl') ? renderTable(block) : renderParagraph(block)).join('');
}

export function renderDocxHtml(buffer: Buffer): string {
  const zip = new AdmZip(buffer);
  const documentEntry = zip.getEntry('word/document.xml');
  if (!documentEntry) throw new Error('DOCX inválido: word/document.xml não encontrado');

  const documentXml = documentEntry.getData().toString('utf8');
  const body = documentXml.match(/<w:body[\s\S]*?>([\s\S]*?)<\/w:body>/)?.[1] ?? documentXml;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body{margin:0;background:#e8e9eb;font-family:"Times New Roman",serif;color:#111;}
  .page{width:794px;min-height:1123px;margin:24px auto;background:#fff;padding:72px 86px;box-shadow:0 8px 30px rgba(0,0,0,.12);box-sizing:border-box;}
  p{font-size:12pt;line-height:1.45;margin:0 0 10pt;}
  table{width:100%;border-collapse:collapse;margin:10pt 0;font-size:11pt;}
  td,th{border:1px solid #111;padding:5pt;vertical-align:top;}
</style>
</head>
<body><main class="page">${renderBlocks(body)}</main></body>
</html>`;
}
