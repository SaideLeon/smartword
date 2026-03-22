import temml from 'temml';
import { mml2omml } from 'mathml2omml';

/**
 * Escapes bare `<` characters that appear inside XML text nodes (i.e., between
 * `>` and `<` delimiters) but are not already escaped as `&lt;`.
 *
 * `temml` can emit `<mo><</mo>` for the less-than sign; `mml2omml` carries
 * this through into the OMML string, causing `ImportedXmlComponent.fromXmlString`
 * to throw "Unencoded <".
 */
function sanitizeXmlTextNodes(xml: string): string {
  let sanitized = '';

  for (let index = 0; index < xml.length; index += 1) {
    const char = xml[index];

    if (char !== '<') {
      sanitized += char;
      continue;
    }

    const remainder = xml.slice(index);
    const tagMatch = remainder.match(/^<\/?[A-Za-z_][\w.:-]*(?:\s[^<>]*?)?>|^<!--[^]*?-->|^<\?[^]*?\?>|^<!\[CDATA\[[^]*?\]\]>/);

    if (tagMatch) {
      sanitized += tagMatch[0];
      index += tagMatch[0].length - 1;
      continue;
    }

    sanitized += '&lt;';
  }

  return sanitized;
}

export async function convertLatexToOmml(latex: string, display: boolean): Promise<string> {
  try {
    // Convert LaTeX → MathML via temml
    const mathml = temml.renderToString(latex, { displayMode: display });

    // Convert MathML → OMML
    const omml = mml2omml(mathml);

    // Sanitize: escape any bare < left in OMML text nodes so that
    // docx's ImportedXmlComponent.fromXmlString receives valid XML.
    return sanitizeXmlTextNodes(omml);
  } catch (error) {
    console.error('Error converting LaTeX to OMML:', error);

    // Fallback: render LaTeX source as plain text inside a math run
    const safeFallback = latex
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:r><m:t>${safeFallback}</m:t></m:r></m:oMath>`;
  }
}
