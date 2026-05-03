// src/lib/docx/requerimento-builder.ts
// Geração do documento Word (.docx) para requerimentos académicos formais.
// Segue a estrutura do modelo oficial mozambicano (Arquivo de Identificação).

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  ImageRun,
  BorderStyle,
  SectionType,
  convertMillimetersToTwip,
  TabStopType,
  PageNumber,
  NumberFormat,
  Footer,
} from 'docx';
import type { RequerimentoData } from './requerimento-types';
import { validateBase64Image } from '@/lib/validation/image-validator';

// ── Dimensões A4 ──────────────────────────────────────────────────────────────

const PAGE_SIZE = {
  width: convertMillimetersToTwip(210),
  height: convertMillimetersToTwip(297),
};

const PAGE_MARGIN = {
  top: convertMillimetersToTwip(30),
  left: convertMillimetersToTwip(30),
  bottom: convertMillimetersToTwip(20),
  right: convertMillimetersToTwip(20),
};

const CONTENT_WIDTH = convertMillimetersToTwip(210 - 30 - 20);

// ── Helpers de parágrafos ─────────────────────────────────────────────────────

function emptyLine(heightPt = 12): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 0, line: heightPt * 20, lineRule: 'exact' as any },
    children: [new TextRun({ text: '', size: 2 })],
  });
}

function centeredParagraph(
  runs: { text: string; bold?: boolean; underline?: boolean; size?: number }[],
  spacingAfter = 0,
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: spacingAfter, line: 240, lineRule: 'auto' as any },
    children: runs.map(
      r =>
        new TextRun({
          text: r.text,
          bold: r.bold,
          size: r.size ?? 24,
          underline: r.underline ? {} : undefined,
        }),
    ),
  });
}

function justifiedParagraph(
  text: string,
  opts: { bold?: boolean; size?: number; spacingBefore?: number; spacingAfter?: number } = {},
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: {
      before: opts.spacingBefore ?? 0,
      after: opts.spacingAfter ?? 120,
      line: 360,
      lineRule: 'auto' as any,
    },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: opts.size ?? 24,
      }),
    ],
  });
}

function justifiedMixedParagraph(
  runs: { text: string; bold?: boolean; size?: number }[],
  opts: { spacingBefore?: number; spacingAfter?: number } = {},
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: {
      before: opts.spacingBefore ?? 0,
      after: opts.spacingAfter ?? 120,
      line: 360,
      lineRule: 'auto' as any,
    },
    children: runs.map(r => new TextRun({ text: r.text, bold: r.bold, size: r.size ?? 24 })),
  });
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 120, line: 360, lineRule: 'auto' as any },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}

function buildPageNumberFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: 'Times New Roman',
            size: 20,
            color: '666666',
          }),
        ],
      }),
    ],
  });
}

// ── Construção de parágrafos de conteúdo de secção ───────────────────────────

function buildSectionContent(rawContent: string): Paragraph[] {
  if (!rawContent.trim()) return [];

  const paragraphs: Paragraph[] = [];
  const lines = rawContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Linha de item "a) ... b) ..."
    if (/^[a-z]\)/.test(trimmed)) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > -1) {
        const label = trimmed.substring(0, colonIdx + 1);
        const rest = trimmed.substring(colonIdx + 1).trim();
        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 80, after: 80, line: 360, lineRule: 'auto' as any },
            indent: { left: convertMillimetersToTwip(10), hanging: convertMillimetersToTwip(10) },
            children: [
              new TextRun({ text: label + ' ', bold: true, size: 24 }),
              new TextRun({ text: rest, size: 24 }),
            ],
          }),
        );
      } else {
        paragraphs.push(justifiedParagraph(trimmed, { spacingBefore: 80, spacingAfter: 80 }));
      }
      continue;
    }

    if (!trimmed) {
      paragraphs.push(emptyLine(6));
      continue;
    }

    paragraphs.push(justifiedParagraph(trimmed));
  }

  return paragraphs;
}

// ── Construção do documento ───────────────────────────────────────────────────

export async function buildRequerimentoDocx(data: RequerimentoData): Promise<Buffer> {
  const children: Paragraph[] = [];

  // ── 1. Logo (opcional) ────────────────────────────────────────────────────
  if (data.logoBase64 && data.logoMediaType) {
    const imageBuffer = validateBase64Image(data.logoBase64, data.logoMediaType);
    if (imageBuffer) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120, line: 240, lineRule: 'auto' as any },
          children: [
            new ImageRun({
              type: data.logoMediaType === 'image/jpeg' ? 'jpg' : 'png',
              data: imageBuffer,
              transformation: { width: 100, height: 100 },
            }),
          ],
        }),
      );
    }
  }

  // ── 2. Cabeçalho institucional ────────────────────────────────────────────
  if (data.includeRepublica) {
    children.push(centeredParagraph([{ text: 'REPÚBLICA DE MOÇAMBIQUE', bold: true, size: 24 }], 60));
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80, line: 240, lineRule: 'auto' as any },
      children: [
        new TextRun({
          text: data.institution,
          bold: true,
          size: 28,
          underline: {},
        }),
      ],
    }),
  );

  children.push(centeredParagraph([{ text: data.courseHeader, bold: true }], 60));

  const locationLine =
    data.province
      ? `${data.city} — ${data.province}`
      : data.city;
  children.push(centeredParagraph([{ text: locationLine, bold: true }], 0));

  // Linha separadora
  children.push(
    new Paragraph({
      spacing: { before: 160, after: 160, line: 240, lineRule: 'auto' as any },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
      children: [],
    }),
  );

  // ── 3. Destinatário ───────────────────────────────────────────────────────
  children.push(
    justifiedMixedParagraph(
      [
        { text: `${data.recipientTitle} ` },
        { text: data.recipientName, bold: true },
        { text: `, do ${data.recipientModule}.` },
      ],
      { spacingAfter: 0 },
    ),
  );

  // Cidade do destinatário — alinhada à direita
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 200, line: 360, lineRule: 'auto' as any },
      children: [new TextRun({ text: data.recipientCity, size: 24 })],
    }),
  );

  // ── 4. Parágrafo de abertura com dados pessoais ───────────────────────────
  const openingText =
    `Eu, ${data.fullName}, filho de ${data.fatherName} e de ${data.motherName}, ` +
    `nascido no dia ${data.birthDate}, natural de ${data.birthPlace}, ` +
    `portador de Bilhete de Identidade nº ${data.docNumber}, ` +
    `emitido em ${data.docIssueDate}, pelo Arquivo de Identificação da ${data.docIssuePlace}, ` +
    `formando do Curso de ${data.courseName}, nível ${data.courseLevel}, Turma ${data.turma}, ` +
    `venho por meio deste, com o devido respeito, solicitar a Vossa Excelência `;

  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 120, line: 360, lineRule: 'auto' as any },
      children: [
        new TextRun({ text: openingText, size: 24 }),
        new TextRun({ text: data.requestPurpose, bold: true, size: 24 }),
        new TextRun({ text: ', nos termos e condições que passo a expor.', size: 24 }),
      ],
    }),
  );

  // ── 5. Secção 1 ───────────────────────────────────────────────────────────
  if (data.section1Title && data.section1Content.trim()) {
    children.push(sectionTitle(data.section1Title));
    children.push(...buildSectionContent(data.section1Content));
  }

  // ── 6. Secção 2 ───────────────────────────────────────────────────────────
  if (data.section2Title && data.section2Content.trim()) {
    children.push(sectionTitle(data.section2Title));
    children.push(...buildSectionContent(data.section2Content));
  }

  // ── 7. Secção 3 / Pedido ─────────────────────────────────────────────────
  if (data.section3Title && data.section3Content.trim()) {
    children.push(sectionTitle(data.section3Title));
    children.push(...buildSectionContent(data.section3Content));
  } else {
    // Parágrafo de pedido padrão se a secção 3 estiver vazia
    children.push(emptyLine(12));
    children.push(
      justifiedMixedParagraph([
        {
          text:
            `Face ao exposto, venho respeitosamente solicitar a Vossa Excelência que se digne a apreciar e ` +
            `aprovar o presente pedido, comprometendo-me a cumprir integralmente as exigências académicas e os prazos estabelecidos.`,
        },
      ]),
    );
  }

  // Frase de deferimento
  children.push(emptyLine(8));
  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 0, after: 40, line: 360, lineRule: 'auto' as any },
      children: [new TextRun({ text: 'Estou disponível para prestar quaisquer esclarecimentos adicionais que Vossa Excelência julgue necessários. Pelo que', size: 24 })],
    }),
  );
  children.push(
    centeredParagraph([{ text: 'Pede deferimento,', bold: true }], 0),
  );

  // ── 8. Local e data ───────────────────────────────────────────────────────
  children.push(emptyLine(16));
  children.push(
    centeredParagraph(
      [{ text: `${data.submissionCity}, ${data.submissionDate}` }],
      160,
    ),
  );

  // Linha de assinatura
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 40, line: 240, lineRule: 'auto' as any },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 4 } },
      children: [new TextRun({ text: '', size: 24 })],
    }),
  );
  children.push(centeredParagraph([{ text: data.fullName, bold: true }], 40));
  children.push(centeredParagraph([{ text: data.requerenteRole }], 0));

  // ── Documento final ───────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 24 },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360, lineRule: 'auto' as const },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: PAGE_SIZE,
            margin: PAGE_MARGIN,
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        footers: { default: buildPageNumberFooter() },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
