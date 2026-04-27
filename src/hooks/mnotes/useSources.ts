import { useAppStore } from '@/store/app-store';
import { Message, Source } from '@/types';
import { useActivity } from './useActivity';
import { NotebookService } from '@/services/notebook.service';

export function useSources() {
  const { sources, setSources, addSource, addMessage, setIsLoading, isLoading } = useAppStore();
  const { logActivity } = useActivity();

  const appendSummaryMessage = (summary: string) => {
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: summary,
    };
    addMessage(assistantMessage);
  };

  const autoSummarizeSource = async (source: Source) => {
    if (!source.data || isLoading) return;

    setIsLoading(true);
    try {
      const summary = await NotebookService.summarize(source);
      appendSummaryMessage(summary);
      logActivity('document_summarized', `${source.name} (auto)`);
    } catch (error) {
      console.error('Erro no resumo automático da fonte:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      const newSource: Source = {
        id: crypto.randomUUID(),
        name: file.name,
        type: 'pdf',
        data: base64,
        selected: true,
      };
      addSource(newSource);
      logActivity('source_added', file.name);
      void autoSummarizeSource(newSource);
    };
    reader.readAsDataURL(file);
  };

  const addTextSource = (title: string, text: string) => {
    const newSource: Source = {
      id: crypto.randomUUID(),
      name: title.endsWith('.txt') ? title : `${title}.txt`,
      type: 'text',
      data: btoa(unescape(encodeURIComponent(text))),
      selected: true,
    };
    addSource(newSource);
    logActivity('source_added', newSource.name);
    void autoSummarizeSource(newSource);
  };

  const toggleSourceSelection = (id: string) => {
    const updated = sources.map(s => s.id === id ? { ...s, selected: !s.selected } : s);
    setSources(updated);
  };

  return {
    handleFileUpload,
    addTextSource,
    toggleSourceSelection,
  };
}
