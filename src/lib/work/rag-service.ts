import { createClient } from '@/lib/supabase';
import { geminiEmbedDocument, geminiEmbedMultimodal, geminiEmbedQuery, geminiGenerateText } from '@/lib/gemini-resilient';
import type { ParsedSource, RagChunkMetadata, RagChunkResult } from './rag-types';

export async function storeDocumentSource(
  sessionId: string,
  userId: string,
  sourceId: string,
  parsed: ParsedSource,
  baseMeta: Pick<RagChunkMetadata, 'filename' | 'source_type'>,
): Promise<void> {
  const supabase = await createClient();

  if (parsed.type === 'text' && parsed.textChunks) {
    for (let i = 0; i < parsed.textChunks.length; i++) {
      const chunkText = parsed.textChunks[i];
      const embedding = await geminiEmbedDocument(chunkText, baseMeta.filename);

      const meta: RagChunkMetadata = {
        ...baseMeta,
        modal_type: 'text',
      };

      const { error } = await supabase.from('work_rag_chunks').insert({
        source_id: sourceId,
        session_id: sessionId,
        user_id: userId,
        chunk_index: i,
        chunk_text: chunkText,
        embedding: `[${embedding.join(',')}]`,
        metadata: meta,
      });

      if (error) throw new Error(error.message);

      if (i > 0 && i % 10 === 0) {
        await new Promise(r => setTimeout(r, 150));
      }
    }

    return;
  }

  if (parsed.binaryChunks) {
    const modalType: RagChunkMetadata['modal_type'] =
      parsed.type === 'pdf_pages' ? 'pdf_visual' : parsed.type === 'image' ? 'image' : 'audio';

    for (let i = 0; i < parsed.binaryChunks.length; i++) {
      const chunk = parsed.binaryChunks[i];
      const embedding = await geminiEmbedMultimodal({
        inlineData: {
          mimeType: chunk.mimeType,
          data: chunk.data,
        },
      });

      const meta: RagChunkMetadata = {
        ...baseMeta,
        modal_type: modalType,
        page_group: chunk.pageGroup,
      };

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

      await new Promise(r => setTimeout(r, 300));
    }
  }
}

export async function semanticSearch(
  sessionId: string,
  query: string,
  topK = 8,
): Promise<RagChunkResult[]> {
  const supabase = await createClient();
  const queryEmbedding = await geminiEmbedQuery(query);

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
