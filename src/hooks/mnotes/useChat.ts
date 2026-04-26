import { useAppStore } from '@/store/mnotes/app-store';
import { Message } from '@/types/mnotes';
import { useActivity } from './useActivity';
import { NotebookService } from '@/services/mnotes/notebook.service';

export function useChat() {
  const { 
    messages, 
    addMessage, 
    setIsLoading, 
    isLoading, 
    sources, 
    selectedNotebook 
  } = useAppStore();
  const { logActivity } = useActivity();

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content
    };

    addMessage(userMessage);
    setIsLoading(true);

    try {
      const text = await NotebookService.chat(
        [...messages, userMessage], 
        sources, 
        selectedNotebook?.title || 'Notebook'
      );

      // Extract citation IDs using regex
      const citationMatches = text.match(/\[Doc (\d+)(?:, pg (\d+))?\]/g);
      const uniqueCitations = citationMatches 
        ? Array.from(new Set(citationMatches.map(m => parseInt(m.match(/\[Doc (\d+)/)![1]))))
        : [];

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text,
        citations: uniqueCitations
      };

      addMessage(assistantMessage);
      logActivity('message_sent', content.slice(0, 40));
    } catch (error) {
      console.error("Error generating response:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarizeDocument = async (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId);
    if (!source || !source.data || isLoading) return;

    setIsLoading(true);
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: `Resuma o documento: ${source.name}`
    });

    try {
      const text = await NotebookService.summarize(source);

      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text
      });
      logActivity('document_summarized', source.name);
    } catch (error) {
      console.error("Error summarizing document:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return { handleSendMessage, handleSummarizeDocument };
}
