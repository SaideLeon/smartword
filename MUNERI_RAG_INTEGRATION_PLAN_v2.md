# Muneri 2.0 — Plano de Integração RAG (v2 — Corrigido conforme docs Google)

> Versão: 2.0 | Corrigido a partir da documentação oficial em 2026-04-11

---

## ⚠️ Erros Encontrados no Plano v1 (vs Documentação Oficial)

| # | O que estava errado | Correcção aplicada |
|---|---|---|
| 1 | Modelo `models/text-embedding-004` (descontinuado) | `gemini-embedding-001` (estável) ou `gemini-embedding-2-preview` |
| 2 | Sintaxe antiga do SDK (`client.getModel(...).embedContent`) | Nova sintaxe: `client.models.embedContent({model, contents})` |
| 3 | Sem `taskType` na busca semântica | Usar `RETRIEVAL_DOCUMENT` para chunks e `RETRIEVAL_QUERY` para queries |
| 4 | Vector(768) fixo sem normalização | Usar `outputDimensionality: 768` + normalizar os vectores antes de guardar |

---

## 1. Modelos de Embedding Disponíveis (Actualizados)

| Modelo | Tipo | Input | Tokens | Dimensões | Estado |
|---|---|---|---|---|---|
| `gemini-embedding-001` | Texto apenas | Texto | 2.048 | 128–3072 (padrão 3072) | ✅ Estável |
| `gemini-embedding-2-preview` | **Multimodal** | Texto, Imagem, Vídeo, Áudio, PDF | 8.192 | 128–3072 (padrão 3072) | 🔬 Preview |

### Recomendação para o Muneri

Usar **`gemini-embedding-001`** com `outputDimensionality: 768` e normalização.  
Motivo: estável, mais barato, e os documentos carregados são texto/DOCX/PDF (conteúdo textual).

Se no futuro quisermos embed directo de PDFs sem parser → migrar para `gemini-embedding-2-preview`.

---

## 2. SDK Correcto a Usar

O plano v1 usava `@google/generative-ai` (SDK antigo). A documentação actual usa `@google/genai`:

```bash
npm install @google/genai
```

```typescript
// ERRADO (SDK antigo — não usar)
import { GoogleGenerativeAI } from '@google/generative-ai';
const client = new GoogleGenerativeAI(apiKey);
const model = client.getModel('models/text-embedding-004');
const result = await model.embedContent({ content: { parts: [{ text }] } });

// CORRECTO (SDK novo — usar este)
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey });
const result = await ai.models.embedContent({
  model: 'gemini-embedding-001',
  contents: 'texto aqui',
});
const embedding = result.embeddings[0].values; // number[]
```

---

## 3. Task Types — Como Optimizar RAG

A documentação define task types que optimizam os embeddings para o caso de uso. Para RAG de documentos académicos:

| Operação | Task Type | Quando usar |
|---|---|---|
| Guardar chunk na BD | `RETRIEVAL_DOCUMENT` | Ao processar ficheiros carregados |
| Buscar chunks por query | `RETRIEVAL_QUERY` | Ao procurar chunks para uma secção |
| Verificar similaridade simples | `SEMANTIC_SIMILARITY` | Testes/debug |

---

## 4. Alterações na Base de Dados (Supabase)

### 4.1 Activar pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4.2 Tabela `work_rag_sources`

```sql
CREATE TABLE public.work_rag_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename    text NOT NULL,
  file_type   text NOT NULL,
  source_type text NOT NULL DEFAULT 'reference',
  char_count  integer,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.work_rag_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_sources" ON public.work_rag_sources
  FOR ALL USING (auth.uid() = user_id);
```

### 4.3 Tabela `work_rag_chunks`

**Correcção v2**: dimensão corrigida para 768 (com `outputDimensionality`) em vez de assumir valor fixo sem normalização.

```sql
CREATE TABLE public.work_rag_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   uuid NOT NULL REFERENCES public.work_rag_sources(id) ON DELETE CASCADE,
  session_id  uuid NOT NULL,
  user_id     uuid NOT NULL,
  chunk_index integer NOT NULL,
  chunk_text  text NOT NULL,
  embedding   vector(768),   -- outputDimensionality: 768, vectores normalizados
  metadata    jsonb
);

CREATE INDEX ON public.work_rag_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.work_rag_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_chunks" ON public.work_rag_chunks
  FOR ALL USING (auth.uid() = user_id);
```

### 4.4 Estender `work_sessions`

```sql
ALTER TABLE public.work_sessions
  ADD COLUMN IF NOT EXISTS rag_enabled       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rag_ficha         jsonb,
  ADD COLUMN IF NOT EXISTS institution_rules text;
```

### 4.5 Função SQL de busca semântica

```sql
CREATE OR REPLACE FUNCTION match_rag_chunks(
  p_session_id      uuid,
  p_query_embedding vector(768),
  p_top_k           integer DEFAULT 8
)
RETURNS TABLE (
  chunk_text text,
  score      float,
  metadata   jsonb
)
LANGUAGE sql STABLE
AS $$
  SELECT
    chunk_text,
    1 - (embedding <=> p_query_embedding) AS score,
    metadata
  FROM work_rag_chunks
  WHERE session_id = p_session_id
  ORDER BY embedding <=> p_query_embedding
  LIMIT p_top_k;
$$;
```

---

## 5. `lib/work/rag-parser.ts` (sem alteração relevante)

```typescript
// lib/work/rag-parser.ts
import mammoth from 'mammoth';

export interface ParsedDocument {
  text: string;
  fileType: 'pdf' | 'docx' | 'txt';
  charCount: number;
}

export async function parseUploadedFile(
  buffer: Buffer,
  filename: string,
): Promise<ParsedDocument> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return { text: data.text, fileType: 'pdf', charCount: data.text.length };
  }

  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer.buffer });
    return { text: result.value, fileType: 'docx', charCount: result.value.length };
  }

  if (ext === 'txt' || ext === 'md') {
    const text = buffer.toString('utf-8');
    return { text, fileType: 'txt', charCount: text.length };
  }

  throw new Error(`Tipo de ficheiro não suportado: .${ext}`);
}

export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 200,
): string[] {
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

## 6. `lib/work/rag-service.ts` — CORRIGIDO

Esta é a secção com mais alterações face ao v1.

```typescript
// lib/work/rag-service.ts
import { GoogleGenAI } from '@google/genai';           // SDK NOVO
import { createSupabaseServerClient } from '@/lib/supabase/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ── Gera embedding com task type correcto ─────────────────────────────────────

/**
 * Gera embedding de um chunk de documento para guardar na BD.
 * Usa taskType RETRIEVAL_DOCUMENT conforme documentação Google.
 * Normaliza o vector porque output_dimensionality < 3072 (ver docs).
 */
export async function embedDocument(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: {
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: 768,
    },
  });

  const values = result.embeddings[0].values;
  return normalizeVector(values);
}

/**
 * Gera embedding de uma query de busca.
 * Usa taskType RETRIEVAL_QUERY conforme documentação Google.
 * IMPORTANTE: task type diferente do documento — optimiza para busca assimétrica.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: {
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 768,
    },
  });

  const values = result.embeddings[0].values;
  return normalizeVector(values);
}

/**
 * Normaliza um vector para norma unitária.
 * OBRIGATÓRIO quando outputDimensionality < 3072 (ver docs Google).
 * O modelo de 3072 dims já é normalizado; os outros não.
 */
function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return values;
  return values.map(v => v / norm);
}

// ── Guardar chunks na BD ──────────────────────────────────────────────────────

export async function storeDocumentChunks(
  sessionId: string,
  userId: string,
  sourceId: string,
  chunks: string[],
  metadata: Record<string, unknown>,
): Promise<void> {
  const supabase = createSupabaseServerClient();

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedDocument(chunks[i]);   // RETRIEVAL_DOCUMENT

    await supabase.from('work_rag_chunks').insert({
      source_id: sourceId,
      session_id: sessionId,
      user_id: userId,
      chunk_index: i,
      chunk_text: chunks[i],
      embedding: `[${embedding.join(',')}]`,
      metadata,
    });

    // Rate limiting suave — a documentação recomenda não exceder limite de taxa
    if (i > 0 && i % 10 === 0) {
      await new Promise(r => setTimeout(r, 150));
    }
  }
}

// ── Busca semântica ───────────────────────────────────────────────────────────

export interface RagChunkResult {
  chunk_text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export async function semanticSearch(
  sessionId: string,
  query: string,
  topK = 8,
): Promise<RagChunkResult[]> {
  const supabase = createSupabaseServerClient();

  // Query usa RETRIEVAL_QUERY — diferente do RETRIEVAL_DOCUMENT dos chunks
  const queryEmbedding = await embedQuery(query);

  const { data, error } = await supabase.rpc('match_rag_chunks', {
    p_session_id: sessionId,
    p_query_embedding: `[${queryEmbedding.join(',')}]`,
    p_top_k: topK,
  });

  if (error) throw new Error(`RAG search failed: ${error.message}`);
  return data ?? [];
}

// ── Geração da ficha técnica ──────────────────────────────────────────────────

export interface RagFicha {
  autores: string[];
  obras: string[];
  conceitos_chave: string[];
  normas_institucionais: string[];
  resumo_fontes: string;
}

export async function generateRagFicha(
  sessionId: string,
  topic: string,
): Promise<RagFicha> {
  const chunks = await semanticSearch(sessionId, topic, 20);
  const context = chunks.map(c => c.chunk_text).join('\n\n---\n\n');

  // Para geração de texto continua a usar o modelo de chat já existente no Muneri
  const { geminiGenerateJSON } = await import('@/lib/gemini-resilient');

  const prompt = `
Analisa os seguintes excertos de documentos académicos sobre o tema "${topic}".
Extrai e devolve APENAS um JSON (sem markdown) com esta estrutura:

{
  "autores": ["Apelido, Nome (Ano)"],
  "obras": ["Título completo — Autor, Ano"],
  "conceitos_chave": ["conceito 1", "conceito 2"],
  "normas_institucionais": ["norma ou regra detectada"],
  "resumo_fontes": "Resumo em 2-3 frases do que os documentos cobrem."
}

DOCUMENTOS:
${context}

Responde APENAS com o JSON, sem explicação nem markdown.
`;

  return await geminiGenerateJSON<RagFicha>(prompt);
}
```

---

## 7. API Route: `app/api/work/rag/upload/route.ts`

```typescript
// app/api/work/rag/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseUploadedFile, chunkText } from '@/lib/work/rag-parser';
import { storeDocumentChunks } from '@/lib/work/rag-service';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;
    const sourceType = (formData.get('sourceType') as string) ?? 'reference';

    if (!file || !sessionId) {
      return NextResponse.json({ error: 'file e sessionId obrigatórios' }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx 10MB)' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseUploadedFile(buffer, file.name);

    const supabase = createSupabaseServerClient();

    const { data: source, error: srcErr } = await supabase
      .from('work_rag_sources')
      .insert({
        session_id: sessionId,
        user_id: auth.userId,
        filename: file.name,
        file_type: parsed.fileType,
        source_type: sourceType,
        char_count: parsed.charCount,
      })
      .select()
      .single();

    if (srcErr) throw srcErr;

    const chunks = chunkText(parsed.text);

    if (sourceType === 'institution_rules') {
      await supabase
        .from('work_sessions')
        .update({ institution_rules: parsed.text.slice(0, 8000) })
        .eq('id', sessionId);
    }

    // storeDocumentChunks usa embedDocument() com RETRIEVAL_DOCUMENT internamente
    await storeDocumentChunks(
      sessionId,
      auth.userId,
      source.id,
      chunks,
      { filename: file.name, source_type: sourceType },
    );

    await supabase
      .from('work_sessions')
      .update({ rag_enabled: true })
      .eq('id', sessionId);

    return NextResponse.json({
      ok: true,
      sourceId: source.id,
      chunksStored: chunks.length,
      filename: file.name,
    });
  } catch (err: any) {
    console.error('[rag/upload]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## 8. Modificação em `app/api/work/develop/route.ts`

```typescript
// Adicionar no topo:
import { semanticSearch, generateRagFicha } from '@/lib/work/rag-service';

// Dentro do handler, após obter session e sectionTitle:

let ragContext = '';

if (session.rag_enabled) {
  // Gerar ficha na 1ª secção e reutilizar nas seguintes
  if (!session.rag_ficha) {
    const ficha = await generateRagFicha(session.id, session.topic);
    await supabase
      .from('work_sessions')
      .update({ rag_ficha: ficha })
      .eq('id', session.id);
    session.rag_ficha = ficha;
  }

  // semanticSearch usa embedQuery() com RETRIEVAL_QUERY internamente
  const sectionQuery = `${sectionTitle} ${session.topic}`;
  const ragChunks = await semanticSearch(session.id, sectionQuery, 8);

  if (ragChunks.length > 0) {
    const ficha = session.rag_ficha;
    const fichaTxt = ficha
      ? `FICHA TÉCNICA:\nAutores: ${ficha.autores?.join('; ')}\nObras: ${ficha.obras?.join('; ')}\nConceitos: ${ficha.conceitos_chave?.join(', ')}\n`
      : '';

    const chunksTxt = ragChunks
      .map((c, i) => `[Excerto ${i + 1}]\n${c.chunk_text}`)
      .join('\n\n---\n\n');

    ragContext = `
[BASE DE CONHECIMENTO — DOCUMENTOS CARREGADOS]
${fichaTxt}
EXCERTOS RELEVANTES PARA ESTA SECÇÃO:
${chunksTxt}

INSTRUÇÕES:
- Baseia os argumentos desta secção nos excertos acima
- Cita os autores reais da ficha técnica (formato APA 7.ª)
- Não inventes referências nem autores — usa APENAS os listados
- Se houver normas institucionais, respeita a estrutura e linguagem prescritas
`;
  }
}

// Montar contexto final (research_brief existente + ragContext novo)
const researchContext = session.research_brief
  ? `\n[FICHA DE PESQUISA]\n${wrapUserInput('user_research_brief', session.research_brief)}\n`
  : '';

const fullContext = researchContext + ragContext;
// Usar fullContext no prompt de geração onde antes era só researchContext
```

---

## 9. Alterações nos Hooks: `hooks/useWorkSession.ts`

```typescript
// Novos tipos
export type WorkStep =
  | 'idle'
  | 'resource_upload'   // ← NOVO
  | 'topic_input'
  | 'generating_outline'
  | 'review_outline'
  | 'outline_approved'
  | 'developing'
  | 'section_ready';

interface RagSource {
  id: string;
  filename: string;
  chunks: number;
  sourceType: 'reference' | 'institution_rules';
}

// Novos estados
const [ragSources, setRagSources] = useState<RagSource[]>([]);
const [uploadingRag, setUploadingRag] = useState(false);

// Funções novas
const startWithResources = useCallback(() => setStep('resource_upload'), []);
const skipResources = useCallback(() => setStep('topic_input'), []);
const confirmResources = useCallback(() => setStep('topic_input'), []);

const uploadRagFile = useCallback(async (
  file: File,
  sessionId: string,
  sourceType: 'reference' | 'institution_rules' = 'reference',
) => {
  setUploadingRag(true);
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', sessionId);
    formData.append('sourceType', sourceType);

    const res = await fetch('/api/work/rag/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Erro ao carregar ficheiro');
    const data = await res.json();

    setRagSources(prev => [...prev, {
      id: data.sourceId,
      filename: file.name,
      chunks: data.chunksStored,
      sourceType,
    }]);
    return data;
  } finally {
    setUploadingRag(false);
  }
}, []);
```

---

## 10. Componente `ResourceUploadStep.tsx`

```tsx
'use client';
import { useState, useRef } from 'react';
import { Upload, FileText, BookOpen, ArrowRight, SkipForward } from 'lucide-react';

interface UploadedFile {
  name: string;
  chunks: number;
  type: 'reference' | 'institution_rules';
}

interface Props {
  sessionId: string;
  onUpload: (file: File, sessionId: string, type: 'reference' | 'institution_rules') => Promise<any>;
  onConfirm: () => void;
  onSkip: () => void;
  uploading: boolean;
}

export function ResourceUploadStep({ sessionId, onUpload, onConfirm, onSkip, uploading }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [activeType, setActiveType] = useState<'reference' | 'institution_rules'>('reference');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    for (const file of selected) {
      const result = await onUpload(file, sessionId, activeType);
      if (result?.ok) {
        setFiles(prev => [...prev, { name: file.name, chunks: result.chunksStored, type: activeType }]);
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold mb-1">Adicionar Recursos de Referência</h2>
        <p className="text-sm text-muted-foreground">
          Opcional. A IA usará estes documentos como base real — autores e obras reais, sem alucinações.
        </p>
      </div>

      <div className="flex gap-2">
        {(['reference', 'institution_rules'] as const).map(type => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors
              ${activeType === type ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'}`}
          >
            {type === 'reference' ? <><BookOpen size={14} /> Referências</> : <><FileText size={14} /> Normas da Instituição</>}
          </button>
        ))}
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
      >
        <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">Clica para seleccionar ficheiros</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, DOCX ou TXT — máx. 10MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-sm">
              <FileText size={14} className="text-primary shrink-0" />
              <span className="flex-1 truncate font-medium">{f.name}</span>
              <span className="text-xs text-muted-foreground">{f.chunks} chunks</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${f.type === 'institution_rules' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                {f.type === 'institution_rules' ? 'Normas' : 'Referência'}
              </span>
            </div>
          ))}
        </div>
      )}

      {uploading && <p className="text-sm text-muted-foreground text-center animate-pulse">A processar ficheiro…</p>}

      <div className="flex gap-3 justify-end mt-2">
        <button onClick={onSkip} className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          <SkipForward size={14} /> Saltar
        </button>
        <button
          onClick={onConfirm}
          disabled={uploading}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Continuar <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
```

---

## 11. Ordem de Implementação

```
Semana 1 — Base
  ☐ npm install @google/genai
  ☐ Migrations SQL (pgvector, tabelas, função match_rag_chunks)
  ☐ lib/work/rag-parser.ts
  ☐ lib/work/rag-service.ts  ← com SDK correcto + task types + normalização

Semana 2 — API
  ☐ app/api/work/rag/upload/route.ts
  ☐ Testar: upload PDF → chunks na BD → verificar embeddings normalizados

Semana 3 — UI
  ☐ Adicionar 'resource_upload' ao WorkStep
  ☐ ResourceUploadStep.tsx
  ☐ Integrar WorkPanel.tsx

Semana 4 — Integração no develop
  ☐ Modificar develop/route.ts com ragContext
  ☐ Testes end-to-end com e sem RAG
  ☐ Validar: IA cita autores reais dos documentos carregados
```

---

## 12. Tabela de Compatibilidade (sem alteração)

| Aspecto | Estado |
|---|---|
| Trabalhos sem RAG (rag_enabled=false) | ✅ Não afectados |
| TCC mode | ✅ Não afectado |
| DOCX export | ✅ Não afectado |
| RLS Supabase | ✅ Isolado por user_id + session_id |
| Planos/entitlements | ⚠️ Considerar limitar ao plano Pro |

---

## 13. Nota sobre Migração Futura de Modelos

A documentação adverte que os espaços de embedding entre `gemini-embedding-001` e `gemini-embedding-2-preview` são **incompatíveis**. Se migrarmos de modelo no futuro, será necessário re-gerar todos os embeddings existentes. Por isso a escolha inicial importa — começar com `gemini-embedding-001` estável é a decisão mais segura.

---

*v2 — Corrigido conforme documentação oficial Google AI: https://ai.google.dev/gemini-api/docs/embeddings*
