// src/app/api/requerimento/generate/route.ts
// Gera e devolve um ficheiro .docx de requerimento académico formal.
// Protegido por autenticação e rate limiting (padrão Muneri).

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { buildRequerimentoDocx } from '@/lib/docx/requerimento-builder';
import { sanitizeExportFilename } from '@/lib/utils/filename';
import type { RequerimentoData } from '@/lib/docx/requerimento-types';

// ── Validação do payload ──────────────────────────────────────────────────────

const REQUIRED_STRING_FIELDS: (keyof RequerimentoData)[] = [
  'institution',
  'courseHeader',
  'city',
  'recipientTitle',
  'recipientName',
  'recipientModule',
  'recipientCity',
  'fullName',
  'fatherName',
  'motherName',
  'birthDate',
  'birthPlace',
  'docNumber',
  'docIssueDate',
  'docIssuePlace',
  'courseName',
  'courseLevel',
  'turma',
  'requestPurpose',
  'submissionCity',
  'submissionDate',
  'requerenteRole',
];

const MAX_FIELD_CHARS = 5_000;
const MAX_SECTION_CHARS = 20_000;

function parseRequerimentoPayload(body: unknown): RequerimentoData | null {
  if (!body || typeof body !== 'object') return null;
  const p = body as Record<string, unknown>;

  // Valida campos obrigatórios
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof p[field] !== 'string' || !(p[field] as string).trim()) return null;
    if ((p[field] as string).length > MAX_FIELD_CHARS) return null;
  }

  // Valida campos de secção (opcionais mas com limite)
  const sectionFields: (keyof RequerimentoData)[] = [
    'section1Title', 'section1Content',
    'section2Title', 'section2Content',
    'section3Title', 'section3Content',
  ];
  for (const field of sectionFields) {
    if (p[field] !== undefined && typeof p[field] !== 'string') return null;
    if (typeof p[field] === 'string' && (p[field] as string).length > MAX_SECTION_CHARS) return null;
  }

  return {
    includeRepublica: p.includeRepublica === true || p.includeRepublica === 'true',
    institution:      (p.institution as string).trim().toLocaleUpperCase('pt-PT'),
    courseHeader:     (p.courseHeader as string).trim(),
    city:             (p.city as string).trim(),
    province:         typeof p.province === 'string' && p.province.trim() ? p.province.trim() : undefined,
    logoBase64:       typeof p.logoBase64 === 'string' && p.logoBase64 ? p.logoBase64 : undefined,
    logoMediaType:    (p.logoMediaType === 'image/png' || p.logoMediaType === 'image/jpeg') ? p.logoMediaType : undefined,

    recipientTitle:   (p.recipientTitle as string).trim(),
    recipientName:    (p.recipientName as string).trim(),
    recipientModule:  (p.recipientModule as string).trim(),
    recipientCity:    (p.recipientCity as string).trim(),

    fullName:         (p.fullName as string).trim(),
    fatherName:       (p.fatherName as string).trim(),
    motherName:       (p.motherName as string).trim(),
    birthDate:        (p.birthDate as string).trim(),
    birthPlace:       (p.birthPlace as string).trim(),
    docNumber:        (p.docNumber as string).trim(),
    docIssueDate:     (p.docIssueDate as string).trim(),
    docIssuePlace:    (p.docIssuePlace as string).trim(),

    courseName:       (p.courseName as string).trim(),
    courseLevel:      (p.courseLevel as string).trim(),
    turma:            (p.turma as string).trim(),

    requestPurpose:   (p.requestPurpose as string).trim(),

    section1Title:    typeof p.section1Title   === 'string' ? p.section1Title.trim()   : '',
    section1Content:  typeof p.section1Content === 'string' ? p.section1Content.trim() : '',
    section2Title:    typeof p.section2Title   === 'string' ? p.section2Title.trim()   : '',
    section2Content:  typeof p.section2Content === 'string' ? p.section2Content.trim() : '',
    section3Title:    typeof p.section3Title   === 'string' ? p.section3Title.trim()   : '',
    section3Content:  typeof p.section3Content === 'string' ? p.section3Content.trim() : '',

    submissionCity:   (p.submissionCity as string).trim(),
    submissionDate:   (p.submissionDate as string).trim(),
    requerenteRole:   (p.requerenteRole as string).trim(),
  };
}

// ── Handler POST ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    scope: 'requerimento:generate',
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const body = await req.json();
    const data = parseRequerimentoPayload(body);

    if (!data) {
      return NextResponse.json(
        { error: 'Payload inválido. Verifica que todos os campos obrigatórios estão preenchidos.' },
        { status: 400 },
      );
    }

    const buffer = await buildRequerimentoDocx(data);

    // Nome do ficheiro baseado no nome do requerente
    const rawFilename = `requerimento-${data.fullName}`;
    const filename = sanitizeExportFilename(rawFilename);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      },
    });
  } catch (error: any) {
    console.error('[requerimento/generate] Erro:', error?.stack ?? error);
    return NextResponse.json(
      { error: 'Falha ao gerar o requerimento. Tenta novamente.' },
      { status: 500 },
    );
  }
}
