-- Metadata esperado para RAG multimodal:
-- {
--   "filename": text,
--   "source_type": "reference" | "institution_rules",
--   "modal_type": "text" | "pdf_visual" | "image" | "audio",
--   "page_group": integer | null
-- }

CREATE INDEX IF NOT EXISTS idx_rag_chunks_modal_type
  ON public.work_rag_chunks ((metadata->>'modal_type'));
