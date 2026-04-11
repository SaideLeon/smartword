# Muneri — Blueprint RAG Multimodal
# gemini-embedding-2-preview com suporte a PDF, Imagem e Áudio

---

## O que muda face ao RAG v1 (texto puro)

| Aspecto             | RAG v1 (actual)               | RAG Multimodal (este blueprint)                  |
|---------------------|-------------------------------|--------------------------------------------------|
| Modelo              | `gemini-embedding-001`        | `gemini-embedding-2-preview`                     |
| Task type           | campo `taskType` na config    | prefixo de texto no `contents`                   |
| PDF                 | pdf-parse → texto → embed     | bytes do PDF → embed directo (lê visualmente)    |
| Imagens             | não suportado                 | PNG / JPEG → embed directo                       |
| Áudio               | não suportado                 | MP3 / WAV ≤ 80s → embed directo                  |
| DOCX / TXT          | mammoth → texto → embed       | igual (texto puro, sem mudança)                  |
| Rastreabilidade     | metadata.filename             | metadata.modal_type + filename + source_type     |

---

## 1. Limites do gemini-embedding-2-preview (docs oficiais)

| Modalidade | Formato       | Limite                         |
|------------|---------------|--------------------------------|
| Texto      | string        | 8 192 tokens                   |
| PDF        | inline base64 | máx 6 páginas por chamada      |
| Imagem     | PNG / JPEG    | máx 6 imagens por chamada      |
| Áudio      | MP3 / WAV     | máx 80 segundos                |
| Vídeo      | MP4 / MOV     | máx 120 segundos (não usar agora) |

> **PDFs grandes**: dividir em grupos de 6 páginas, uma chamada por grupo.

---

## 2. Ficheiros a modificar / criar

```
src/lib/work/
├── rag-parser.ts          ← MODIFICAR: adicionar suporte a imagem e PDF por páginas
├── rag-service.ts         ← MODIFICAR: novo embedDocumentMultimodal()
└── rag-types.ts           ← CRIAR: tipos partilhados

src/app/api/work/rag/
└── upload/route.ts        ← MODIFICAR: aceitar imagens + validação de áudio

src/lib/gemini-resilient.ts ← MODIFICAR: já tem geminiEmbedDocument/Query,
                                          adicionar geminiEmbedMultimodal()
```

---

## 3. `src/lib/work/rag-types.ts` — CRIAR

```typescript
// src/lib/work/rag-types.ts

export type ModalType = 'text' | 'pdf_visual' | 'image' | 'audio';

export interface RagChunkMetadata {
  filename: string;
  source_type: 'reference' | 'institution_rules';
  modal_type: ModalType;
  page_group?: number;   // para PDFs grandes: grupo de 6 páginas
}

export interface RagChunkResult {
  chunk_text: string;   // descrição textual do chunk (para PDFs/imagens: texto extraído pelo modelo)
  score: number;
  metadata: RagChunkMetadata;
}

export interface ParsedSource {
  type: 'text' | 'pdf_pages' | 'image' | 'audio';
  // Para texto/DOCX/TXT:
  textChunks?: string[];
  // Para PDF (visual), imagem, áudio:
  binaryChunks?: Array<{
    data: string;        // base64
    mimeType: string;
    label: string;       // ex: "pág 1-6", "figura_1.png"
    pageGroup?: number;
  }>;
  charCount: number;
  fileType: string;
}
```

---

## 4. `src/lib/work/rag-parser.ts` — MODIFICAR

Substituir o conteúdo actual por esta versão que distingue ficheiros de texto de ficheiros binários:

```typescript
// src/lib/work/rag-parser.ts
import type { ParsedSource } from './rag-types';

const PAGES_PER_CHUNK = 6;  // limite do gemini-embedding-2-preview

/**
 * Detecta se o PDF tem texto extraível ou se é maioritariamente visual (scanned).
 * Usa os primeiros 2000 caracteres extraídos pelo pdf-parse como heurística.
 */
async function pdfHasExtractableText(buffer: Buffer): Promise<boolean> {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer, { max: 2 });  // só as primeiras 2 páginas
    return data.text.trim().length > 200;
  } catch {
    return false;
  }
}

/**
 * Divide um buffer de PDF em grupos de PAGES_PER_CHUNK páginas.
 * Usa pdf-lib para extrair subsets de páginas — cada subset é devolvido como Buffer.
 */
async function splitPdfByPages(buffer: Buffer): Promise<Buffer[]> {
  const { PDFDocument } = require('pdf-lib');
  const srcDoc = await PDFDocument.load(buffer);
  const totalPages = srcDoc.getPageCount();
  const groups: Buffer[] = [];

  for (let start = 0; start < totalPages; start += PAGES_PER_CHUNK) {
    const end = Math.min(start + PAGES_PER_CHUNK, totalPages);
    const subDoc = await PDFDocument.create();
    const pages = await subDoc.copyPages(srcDoc, Array.from({ length: end - start }, (_, i) => start + i));
    pages.forEach(p => subDoc.addPage(p));
    const bytes = await subDoc.save();
    groups.push(Buffer.from(bytes));
  }

  return groups;
}

export async function parseUploadedFile(
  buffer: Buffer,
  filename: string,
): Promise<ParsedSource> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  // ── DOCX / TXT / MD → texto puro (chunking normal) ─────────────────────────
  if (ext === 'docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: buffer.buffer });
    const text = result.value as string;
    return {
      type: 'text',
      textChunks: chunkText(text),
      charCount: text.length,
      fileType: 'docx',
    };
  }

  if (ext === 'txt' || ext === 'md') {
    const text = buffer.toString('utf-8');
    return {
      type: 'text',
      textChunks: chunkText(text),
      charCount: text.length,
      fileType: 'txt',
    };
  }

  // ── PDF → tentar texto; se falhar, usar embedding visual por páginas ─────────
  if (ext === 'pdf') {
    const hasText = await pdfHasExtractableText(buffer);

    if (hasText) {
      // PDF com texto → extracção normal (mais barato e mais rápido)
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return {
        type: 'text',
        textChunks: chunkText(data.text),
        charCount: data.text.length,
        fileType: 'pdf_text',
      };
    } else {
      // PDF visual (scanned, com figuras, tabelas) → embedding multimodal por páginas
      const pageGroups = await splitPdfByPages(buffer);
      return {
        type: 'pdf_pages',
        binaryChunks: pageGroups.map((group, i) => ({
          data: group.toString('base64'),
          mimeType: 'application/pdf',
          label: `pág ${i * PAGES_PER_CHUNK + 1}–${Math.min((i + 1) * PAGES_PER_CHUNK, 999)}`,
          pageGroup: i,
        })),
        charCount: buffer.length,
        fileType: 'pdf_visual',
      };
    }
  }

  // ── Imagem (PNG / JPEG) → embedding multimodal directo ───────────────────────
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    return {
      type: 'image',
      binaryChunks: [{
        data: buffer.toString('base64'),
        mimeType,
        label: filename,
      }],
      charCount: buffer.length,
      fileType: 'image',
    };
  }

  // ── Áudio (MP3 / WAV) → embedding multimodal directo ────────────────────────
  if (ext === 'mp3' || ext === 'wav') {
    const mimeType = ext === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    return {
      type: 'audio',
      binaryChunks: [{
        data: buffer.toString('base64'),
        mimeType,
        label: filename,
      }],
      charCount: buffer.length,
      fileType: 'audio',
    };
  }

  throw new Error(`Tipo de ficheiro não suportado: .${ext}`);
}

export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start += chunkSize - overlap;
  }
  return chunks;
}
```

---

## 5. `src/lib/gemini-resilient.ts` — adicionar no fim

Adicionar depois das funções `geminiEmbedDocument` / `geminiEmbedQuery` já existentes:

```typescript
// ── Embedding multimodal (PDF visual, imagem, áudio) ─────────────────────────
//
// gemini-embedding-2-preview aceita conteúdo binário via inlineData.
// NÃO usa prefixo de texto — o conteúdo é a própria modalidade.
// Suporta: image/png, image/jpeg, audio/mpeg, audio/wav, application/pdf

export interface InlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;    // base64
  };
}

/**
 * Gera embedding de conteúdo binário (PDF, imagem, áudio).
 * Usa gemini-embedding-2-preview com inlineData.
 */
export async function geminiEmbedMultimodal(part: InlineDataPart): Promise<number[]> {
  const keys = collectGeminiKeys();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY não configurada.');

  for (let i = 0; i < keys.length; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey: keys[i] });
      const result = await ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: part,            // Part object com inlineData
        config: { outputDimensionality: EMBED_DIMS },
      });

      const values = result.embeddings[0].values;
      return normalizeVector(values);
    } catch (error: any) {
      const status = extractStatusFromError(error);
      if (i < keys.length - 1 && canRetryWithNextKey(status)) continue;
      throw new Error(error?.message ?? 'Erro ao gerar embedding multimodal.');
    }
  }

  throw new Error('Falha ao gerar embedding multimodal.');
}
```

---

## 6. `src/lib/work/rag-service.ts` — substituir `storeDocumentChunks`

```typescript
// src/lib/work/rag-service.ts
// Substituir a função storeDocumentChunks e adicionar storeDocumentSource

import type { ParsedSource, RagChunkMetadata } from './rag-types';
import {
  geminiEmbedDocument,
  geminiEmbedMultimodal,
} from '@/lib/gemini-resilient';

/**
 * Ponto de entrada único para guardar qualquer tipo de fonte na BD.
 * Detecta automaticamente se é texto (chunks de string) ou binário (inlineData).
 */
export async function storeDocumentSource(
  sessionId: string,
  userId: string,
  sourceId: string,
  parsed: ParsedSource,
  baseMeta: Pick<RagChunkMetadata, 'filename' | 'source_type'>,
): Promise<void> {
  const supabase = await createClient();

  if (parsed.type === 'text' && parsed.textChunks) {
    // Caminho texto (DOCX, TXT, PDF com texto)
    for (let i = 0; i < parsed.textChunks.length; i++) {
      const embedding = await geminiEmbedDocument(parsed.textChunks[i], baseMeta.filename);

      const meta: RagChunkMetadata = {
        ...baseMeta,
        modal_type: 'text',
      };

      const { error } = await supabase.from('work_rag_chunks').insert({
        source_id: sourceId,
        session_id: sessionId,
        user_id: userId,
        chunk_index: i,
        chunk_text: parsed.textChunks[i],
        embedding: `[${embedding.join(',')}]`,
        metadata: meta,
      });

      if (error) throw new Error(error.message);

      if (i > 0 && i % 10 === 0) await new Promise(r => setTimeout(r, 150));
    }
    return;
  }

  if (parsed.binaryChunks) {
    // Caminho multimodal (PDF visual, imagem, áudio)
    const modalType: RagChunkMetadata['modal_type'] =
      parsed.type === 'pdf_pages' ? 'pdf_visual' :
      parsed.type === 'image'     ? 'image' : 'audio';

    for (let i = 0; i < parsed.binaryChunks.length; i++) {
      const chunk = parsed.binaryChunks[i];

      const embedding = await geminiEmbedMultimodal({
        inlineData: { mimeType: chunk.mimeType, data: chunk.data },
      });

      const meta: RagChunkMetadata = {
        ...baseMeta,
        modal_type: modalType,
        page_group: chunk.pageGroup,
      };

      // chunk_text guarda a label descritiva (usada no ragContext do prompt)
      const { error } = await supabase.from('work_rag_chunks').insert({
        source_id: sourceId,
        session_id: sessionId,
        user_id: userId,
        chunk_index: i,
        chunk_text: `[${modalType.toUpperCase()}] ${chunk.label} — ${baseMeta.filename}`,
        embedding: `[${embedding.join(',')}]`,
        metadata: meta,
      });

      if (error) throw new Error(error.message);

      // Rate limiting mais conservador para conteúdo binário
      await new Promise(r => setTimeout(r, 300));
    }
  }
}
```

---

## 7. `src/app/api/work/rag/upload/route.ts` — MODIFICAR

Substituir a chamada a `storeDocumentChunks` e expandir os tipos aceites:

```typescript
// Tipos aceites (adicionar ao topo do ficheiro)
const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'audio/mpeg',
  'audio/wav',
]);

// Substituir a secção de processamento de cada ficheiro:
const parsed = await parseUploadedFile(buffer, file.name);

// Guardar metadados na BD
const { data: source, error: srcErr } = await supabase
  .from('work_rag_sources')
  .insert({
    session_id:  sessionId,
    user_id:     user.id,
    filename:    file.name,
    file_type:   parsed.fileType,
    source_type: sourceType,
    char_count:  parsed.charCount,
  })
  .select('id')
  .single();

if (srcErr || !source) throw new Error(srcErr?.message ?? 'Erro ao criar fonte RAG');

// storeDocumentSource substitui storeDocumentChunks
await storeDocumentSource(
  sessionId,
  user.id,
  source.id,
  parsed,
  { filename: file.name, source_type: sourceType as 'reference' | 'institution_rules' },
);
```

---

## 8. Migration SQL — adicionar coluna `modal_type` ao índice

O índice ivfflat existente não precisa de mudança. Apenas garantir que `metadata` pode guardar `modal_type`:

```sql
-- Já está como jsonb — apenas documentar os campos esperados:
-- metadata: {
--   filename:     text,
--   source_type:  'reference' | 'institution_rules',
--   modal_type:   'text' | 'pdf_visual' | 'image' | 'audio',
--   page_group:   integer | null
-- }

-- Índice opcional para filtrar por modal_type em queries futuras:
CREATE INDEX IF NOT EXISTS idx_rag_chunks_modal_type
  ON public.work_rag_chunks ((metadata->>'modal_type'));
```

---

## 9. Dependência nova: `pdf-lib`

Para dividir PDFs grandes em grupos de 6 páginas:

```bash
npm install pdf-lib
```

`pdf-parse` (já instalado) continua a ser usado para detectar se o PDF tem texto.

---

## 10. Prompt de ragContext em `develop/route.ts`

Actualizar para mencionar quando o contexto vem de imagens/áudio:

```typescript
const chunksTxt = ragChunks
  .map((c, i) => {
    const icon =
      c.metadata?.modal_type === 'image'      ? '[FIGURA]' :
      c.metadata?.modal_type === 'pdf_visual' ? '[PDF VISUAL]' :
      c.metadata?.modal_type === 'audio'      ? '[ÁUDIO]' : '[TEXTO]';
    return `${icon} Excerto ${i + 1}:\n${c.chunk_text}`;
  })
  .join('\n\n---\n\n');

ragContext = `
[BASE DE CONHECIMENTO MULTIMODAL — DOCUMENTOS CARREGADOS]
${fichaTxt}
EXCERTOS RELEVANTES (incluindo conteúdo visual e áudio indexado):
${chunksTxt}

INSTRUÇÕES:
- Baseia os argumentos nos excertos acima
- [FIGURA] e [PDF VISUAL] indicam que o conteúdo foi extraído visualmente
- [ÁUDIO] indica que foi extraído de gravação de voz ou conferência
- Cita os autores reais da ficha técnica (APA 7.ª)
- Não inventes referências — usa APENAS as listadas
`;
```

---

## 11. Ordem de implementação

```
Semana 1 — Tipos e infraestrutura
  ☐ Criar rag-types.ts
  ☐ npm install pdf-lib
  ☐ Adicionar geminiEmbedMultimodal() a gemini-resilient.ts
  ☐ SQL: índice metadata->>'modal_type'

Semana 2 — Parser e service
  ☐ Substituir rag-parser.ts (lógica de detecção PDF + splitPdfByPages)
  ☐ Substituir storeDocumentChunks → storeDocumentSource em rag-service.ts
  ☐ Testar: PDF scanned → chunks na BD com modal_type='pdf_visual'

Semana 3 — Upload route e UI
  ☐ Expandir tipos aceites na upload/route.ts
  ☐ Actualizar ResourceUploadStep.tsx: aceitar .png, .jpg, .mp3, .wav
  ☐ Mostrar badge do modal_type na lista de ficheiros carregados

Semana 4 — Develop route e testes
  ☐ Actualizar ragContext com ícones por modal_type
  ☐ Teste end-to-end: carregar artigo PDF scanned + imagem → desenvolver secção
  ☐ Verificar qualidade vs RAG texto-puro
```

---

## 12. Compatibilidade com o RAG v1

Sessões antigas com `rag_enabled = true` e chunks gerados com `gemini-embedding-001` continuam a funcionar — os vectores desse modelo estão guardados na BD com 768 dims. O novo código usa `gemini-embedding-2-preview` que também produz 768 dims com `outputDimensionality: 768`.

**Mas**: os espaços de embedding são incompatíveis entre modelos — não misturar chunks de modelos diferentes na mesma busca. Solução simples: adicionar `embed_model text` à tabela `work_rag_sources` e filtrar no `match_rag_chunks`:

```sql
ALTER TABLE public.work_rag_sources
  ADD COLUMN IF NOT EXISTS embed_model text DEFAULT 'gemini-embedding-2-preview';
```

```sql
-- Actualizar a função match_rag_chunks para filtrar por modelo
CREATE OR REPLACE FUNCTION match_rag_chunks(
  p_session_id      uuid,
  p_query_embedding vector(768),
  p_top_k           integer DEFAULT 8
)
RETURNS TABLE (chunk_text text, score float, metadata jsonb)
LANGUAGE sql STABLE AS $$
  SELECT
    c.chunk_text,
    1 - (c.embedding <=> p_query_embedding) AS score,
    c.metadata
  FROM work_rag_chunks c
  JOIN work_rag_sources s ON s.id = c.source_id
  WHERE c.session_id = p_session_id
    AND s.embed_model = 'gemini-embedding-2-preview'
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT p_top_k;
$$;
```

---

*Blueprint gerado a partir do código actual do Muneri + documentação oficial Google AI*
*https://ai.google.dev/gemini-api/docs/embeddings*
