import {
  Paragraph, TextRun, AlignmentType, ImageRun,
  TabStopType, SectionType, BorderStyle, convertMillimetersToTwip,
} from 'docx';
import type { CoverData } from './cover-types';
import { calculateCoverLayout, calculateBackCoverLayout } from './cover-layout';

// ── Dimensões de página (mesmas do docx-builder.ts) ──────────────────────────

const PAGE_SIZE = {
  width:  convertMillimetersToTwip(210),
  height: convertMillimetersToTwip(297),
};

const PAGE_MARGIN = {
  top:    convertMillimetersToTwip(30),
  left:   convertMillimetersToTwip(30),
  bottom: convertMillimetersToTwip(20),
  right:  convertMillimetersToTwip(20),
};

/** Largura útil do conteúdo em twips — usada para o tab stop do docente */
const CONTENT_WIDTH = convertMillimetersToTwip(210 - 30 - 20);

/** Metade da largura útil — recuo do resumo na contra-capa */
const HALF_CONTENT_WIDTH = Math.floor(CONTENT_WIDTH / 2);

// ── Helpers de construção de parágrafos ───────────────────────────────────────

/**
 * Parágrafo espaçador com altura exacta em twips.
 * Usa lineRule 'exact' para que o Word respeite o valor sem ajustes.
 * O TextRun de 1pt garante que o glifo não adiciona altura adicional.
 */
function spacer(twips: number): Paragraph {
  return new Paragraph({
    spacing: {
      before:   0,
      after:    0,
      line:     Math.max(twips, 240), // mínimo de 12pt para não colapsar
      lineRule: 'exact' as any,
    },
    children: [new TextRun({ text: '', size: 2 })],
  });
}

/** Parágrafo de linha simples centrado */
function centeredLine(
  runs: { text: string; bold?: boolean; size?: number }[],
  spacingAfter = 0,
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: spacingAfter, line: 240, lineRule: 'auto' as any },
    children: runs.map(r => new TextRun({ text: r.text, bold: r.bold, size: r.size ?? 24 })),
  });
}

/** Parágrafo alinhado à esquerda */
function leftLine(
  runs: { text: string; bold?: boolean; size?: number }[],
  spacingAfter = 0,
): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: spacingAfter, line: 240, lineRule: 'auto' as any },
    children: runs.map(r => new TextRun({ text: r.text, bold: r.bold, size: r.size ?? 24 })),
  });
}

/**
 * Linha de membro — o nome vai à esquerda.
 * Se for a linha do docente, coloca "Docente: Nome" alinhado à direita
 * com um tab stop na margem direita.
 */
function memberLine(
  member: string,
  isTeacherLine: boolean,
  teacher: string,
  fontSizeHalfPt: number,
): Paragraph {
  if (!isTeacherLine) {
    return new Paragraph({
      spacing: { before: 0, after: 80, line: 240, lineRule: 'auto' as any },
      children: [new TextRun({ text: member, size: fontSizeHalfPt })],
    });
  }

  return new Paragraph({
    spacing: { before: 0, after: 80, line: 240, lineRule: 'auto' as any },
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
    children: [
      new TextRun({ text: member, size: fontSizeHalfPt }),
      // O \t salta para o tab stop RIGHT, encostando o texto seguinte à margem direita
      new TextRun({ text: '\tDocente: ', size: fontSizeHalfPt }),
      new TextRun({ text: teacher, bold: true, size: fontSizeHalfPt }),
    ],
  });
}

// ── Bloco de cabeçalho partilhado (instituição + delegação) ──────────────────

function headerBlock(data: CoverData): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100, line: 240, lineRule: 'auto' as any },
      children: [
        new TextRun({
          text:      data.institution,
          bold:      true,
          size:      28,       // 14pt
          underline: {},       // sublinhado simples — visível nos screenshots
        }),
      ],
    }),
  );

  if (data.delegation) {
    paragraphs.push(
      centeredLine([{ text: data.delegation, bold: true }], 0),
    );
  }

  return paragraphs;
}

// ── Bloco de metadados (Curso / Disciplina / Tema) ────────────────────────────

function metadataBlock(data: CoverData): Paragraph[] {
  return [
    centeredLine([{ text: data.course, bold: true }], 120),
    centeredLine([{ text: data.subject, bold: true }], 120),
    centeredLine([{ text: data.theme, bold: true }], 0),
  ];
}

// ── Bloco de membros ──────────────────────────────────────────────────────────

function membersBlock(
  data: CoverData,
  teacherLineIndex: number,
  fontSizeHalfPt: number,
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  if (data.group) {
    paragraphs.push(leftLine([{ text: data.group }], 120));
  }

  data.members.forEach((member, idx) => {
    paragraphs.push(
      memberLine(member, idx === teacherLineIndex, data.teacher, fontSizeHalfPt),
    );
  });

  return paragraphs;
}

// ── Linha de data ─────────────────────────────────────────────────────────────

function dateLine(data: CoverData): Paragraph {
  return centeredLine([{ text: `${data.city}, ${data.date}`, bold: true }], 0);
}

// ── Capa (com logo) ───────────────────────────────────────────────────────────

function buildCoverSection(data: CoverData): object {
  const metrics = calculateCoverLayout(data);
  const children: Paragraph[] = [];

  // 1. Logo (opcional)
  if (data.logoBase64) {
    const rawBase64 = data.logoBase64.replace(/^data:[^;]+;base64,/, '');

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120, line: 240, lineRule: 'auto' as any },
        children: [
          new ImageRun({
            type: data.logoMediaType === 'image/jpeg' ? 'jpg' : 'png',
            data: Buffer.from(rawBase64, 'base64'),
            transformation: { width: 132, height: 132 }, // ≈ 35mm a 96 DPI
          }),
        ],
      }),
    );
  }

  // 2. Cabeçalho (instituição + delegação)
  children.push(...headerBlock(data));

  // GAP 1
  children.push(spacer(metrics.gap1));

  // 3. Metadados
  children.push(...metadataBlock(data));

  // GAP 2
  children.push(spacer(metrics.gap2));

  // 4. Membros
  children.push(...membersBlock(data, metrics.teacherLineIndex, metrics.memberFontSizeHalfPt));

  // GAP 3
  children.push(spacer(metrics.gap3));

  // 5. Data
  children.push(dateLine(data));

  return {
    properties: {
      page: {
        size: PAGE_SIZE,
        margin: PAGE_MARGIN,
        borders: {
          pageBorderTop:    { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 20 },
          pageBorderBottom: { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 20 },
          pageBorderLeft:   { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 20 },
          pageBorderRight:  { style: BorderStyle.SINGLE, size: 12, color: '000000', space: 20 },
        },
      },
      // Sem rodapé de paginação nas capas
    },
    children,
  };
}

// ── Contra-capa (sem logo, com resumo) ───────────────────────────────────────

function buildBackCoverSection(data: CoverData): object {
  const metrics = calculateBackCoverLayout(data);
  const children: Paragraph[] = [];

  // 1. Cabeçalho (instituição + delegação — sem logo)
  children.push(...headerBlock(data));

  // GAP 1
  children.push(spacer(metrics.gap1));

  // 2. Metadados
  children.push(...metadataBlock(data));

  // GAP 2
  children.push(spacer(metrics.gap2));

  // 3. Membros (docente na linha central)
  children.push(...membersBlock(data, metrics.teacherLineIndex, metrics.memberFontSizeHalfPt));

  // 4. Resumo (se fornecido)
  if (data.abstract) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { before: 200, after: 0, line: 240, lineRule: 'auto' as any },
        indent:  { left: HALF_CONTENT_WIDTH },
        children: [new TextRun({ text: data.abstract, size: 24 })],
      }),
    );
  }

  // GAP 3
  children.push(spacer(metrics.gap3));

  // 5. Data
  children.push(dateLine(data));

  return {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: PAGE_SIZE,
        margin: PAGE_MARGIN,
      },
    },
    children,
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Retorna as duas secções de capa e contra-capa prontas para passar ao Document.
 * O terceiro elemento do array (conteúdo do trabalho) é responsabilidade de
 * buildDocxDocument / buildContentSections em docx-builder.ts.
 */
export function buildCoverSections(data: CoverData): object[] {
  return [buildCoverSection(data), buildBackCoverSection(data)];
}
