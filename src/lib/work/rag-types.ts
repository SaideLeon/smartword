export type ModalType = 'text' | 'pdf_visual' | 'image' | 'audio';

export interface RagChunkMetadata {
  filename: string;
  source_type: 'reference' | 'institution_rules';
  modal_type: ModalType;
  page_group?: number;
}

export interface RagChunkResult {
  chunk_text: string;
  score: number;
  metadata: RagChunkMetadata;
}

export interface ParsedSource {
  type: 'text' | 'pdf_pages' | 'image' | 'audio';
  textChunks?: string[];
  binaryChunks?: Array<{
    data: string;
    mimeType: string;
    label: string;
    pageGroup?: number;
  }>;
  charCount: number;
  fileType: string;
}
