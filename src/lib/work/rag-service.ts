import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return values;
  return values.map(v => v / norm);
}

export async function embedDocument(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: {
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: 768,
    },
  });

  return normalizeVector(result.embeddings?.[0]?.values ?? []);
}

export async function embedQuery(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: {
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 768,
    },
  });

  return normalizeVector(result.embeddings?.[0]?.values ?? []);
}

export async function storeDocumentChunks(
  sessionId: string,
  userId: string,
  sourceId: string,
  chunks: string[],
  metadata: Record<string, unknown>,
): Promise<void> {
  const supabase = await createClient();

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedDocument(chunks[i]);
    const { error } = await supabase.from('work_rag_chunks').insert({
      source_id: sourceId,
      session_id: sessionId,
      user_id: userId,
      chunk_index: i,
      chunk_text: chunks[i],
      embedding: `[${embedding.join(',')}]`,
      metadata,
    });
    if (error) throw new Error(error.message);

    if (i > 0 && i % 10 === 0) {
      await new Promise(r => setTimeout(r, 150));
    }
  }
}

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
  const supabase = await createClient();
  const queryEmbedding = await embedQuery(query);

  const { data, error } = await supabase.rpc('match_rag_chunks', {
    p_session_id: sessionId,
    p_query_embedding: `[${queryEmbedding.join(',')}]`,
    p_top_k: topK,
  });

  if (error) throw new Error(`RAG search failed: ${error.message}`);
  return (data ?? []) as RagChunkResult[];
}

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
  const { geminiGenerateText } = await import('@/lib/gemini-resilient');

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

  const raw = await geminiGenerateText({
    messages: [
      { role: 'system', content: 'Responde apenas com JSON válido.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    maxOutputTokens: 1200,
  });

  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as Partial<RagFicha>;

  return {
    autores: Array.isArray(parsed.autores) ? parsed.autores : [],
    obras: Array.isArray(parsed.obras) ? parsed.obras : [],
    conceitos_chave: Array.isArray(parsed.conceitos_chave) ? parsed.conceitos_chave : [],
    normas_institucionais: Array.isArray(parsed.normas_institucionais) ? parsed.normas_institucionais : [],
    resumo_fontes: typeof parsed.resumo_fontes === 'string' ? parsed.resumo_fontes : '',
  };
}
