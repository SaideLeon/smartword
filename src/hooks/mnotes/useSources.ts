import { useAppStore } from '@/store/app-store';
import { Message, Source } from '@/types';
import { useActivity } from './useActivity';
import { NotebookService } from '@/services/notebook.service';

export function useSources() {
  const { sources, setSources, addSource, addMessage, setIsLoading, isLoading } = useAppStore();
  const { logActivity } = useActivity();

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string | undefined;
        const base64 = result?.split(',')[1];
        if (!base64) {
          reject(new Error(`Não foi possível ler o arquivo ${file.name}.`));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error(`Erro ao ler o arquivo ${file.name}.`));
      reader.readAsDataURL(file);
    });

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const pdfFiles = files.filter((file) => file.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    try {
      const newSources = await Promise.all(
        pdfFiles.map(async (file) => {
          const base64 = await readFileAsBase64(file);
          return {
            source: {
              id: crypto.randomUUID(),
              name: file.name,
              type: 'pdf' as const,
              data: base64,
              selected: true,
            },
            fileName: file.name,
          };
        })
      );

      newSources.forEach(({ source, fileName }) => {
        addSource(source);
        logActivity('source_added', fileName);
        void autoSummarizeSource(source);
      });
    } catch (error) {
      console.error('Erro ao importar arquivos PDF:', error);
    }

    e.target.value = '';
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
