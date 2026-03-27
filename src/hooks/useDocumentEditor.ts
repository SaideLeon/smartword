'use client';

import { useEffect, useState } from 'react';
import { useEditorActions, useEditorContent, useEditorMeta } from '@/hooks/useEditorStore';
import { formalizePreviewHeadings } from '@/lib/preview-heading-formalizer';

const PREVIEW_DEBOUNCE_MS = 200;

export function useDocumentEditor() {
  const markdown = useEditorContent();
  const [previewMarkdown, setPreviewMarkdown] = useState(() => formalizePreviewHeadings(markdown));
  const { filename } = useEditorMeta();
  const { setContent, setFilename, clearDefaultContent, setFilenameFromTopic } = useEditorActions();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPreviewMarkdown(formalizePreviewHeadings(markdown));
    }, PREVIEW_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [markdown]);

  const exportDocx = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: markdown, filename }),
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
    setFilename,
    loading,
    exportDocx,
    clearDefaultMarkdown: clearDefaultContent,
    setFilenameFromTopic,
  };
}
