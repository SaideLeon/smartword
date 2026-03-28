'use client';

import { useEffect, useState } from 'react';
import { useEditorActions, useEditorContent, useEditorMeta, useExportPreferences } from '@/hooks/useEditorStore';
import { formalizePreviewHeadings } from '@/lib/preview-heading-formalizer';

const PREVIEW_DEBOUNCE_MS = 200;

export function useDocumentEditor() {
  const markdown = useEditorContent();
  const [previewMarkdown, setPreviewMarkdown] = useState(() => formalizePreviewHeadings(markdown));
  const { filename, includeCover } = useEditorMeta();
  const { coverData } = useExportPreferences();
  const { setContent, setFilename, clearDefaultContent, setFilenameFromTopic } = useEditorActions();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPreviewMarkdown(formalizePreviewHeadings(markdown));
    }, PREVIEW_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [markdown]);

  const exportDocument = async (options?: { includeCover?: boolean }) => {
    const shouldIncludeCover = options?.includeCover ?? includeCover;
    setLoading(true);

    try {
      const endpoint = shouldIncludeCover && coverData ? '/api/cover/export' : '/api/export';
      const payload = shouldIncludeCover && coverData
        ? { coverData, markdown, filename }
        : { content: markdown, filename };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Failed to export DOCX');
    } finally {
      setLoading(false);
    }
  };

  return {
    markdown,
    previewMarkdown,
    setMarkdown: setContent,
    filename,
    includeCover,
    setFilename,
    loading,
    exportDocx: exportDocument,
    exportDocument,
    clearDefaultMarkdown: clearDefaultContent,
    setFilenameFromTopic,
  };
}
