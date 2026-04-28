import { useAppStore } from '@/store/app-store';
import { Message, Source } from '@/types';
import { useCallback, useState } from 'react';
import { NotebookService } from '@/services/notebook.service';

export function useSuggestions() {
  const { selectedNotebook } = useAppStore();
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  const generateSuggestions = useCallback(async (currentSources: Source[]) => {
    const activeSources = currentSources.filter(s => s.selected && s.data);
    if (activeSources.length === 0) {
      setSuggestedQuestions([]);
      return;
    }

    setIsGeneratingSuggestions(true);
    try {
      const questions = await NotebookService.getSuggestions(currentSources);
      setSuggestedQuestions(questions);
    } catch (error) {
      console.error("Error generating suggestions:", error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, []);

  const generateDynamicSuggestions = useCallback(async (conversationMessages: Message[], currentSources: Source[]) => {
    const activeSources = currentSources.filter(s => s.selected && s.data);
    if (activeSources.length === 0) {
      setSuggestedQuestions([]);
      return;
    }

    setIsGeneratingSuggestions(true);
    try {
      const questions = await NotebookService.getDynamicSuggestions(
        conversationMessages,
        activeSources,
        selectedNotebook?.title || 'Notebook'
      );
      setSuggestedQuestions(questions);
    } catch (error) {
      console.error('Error generating dynamic suggestions:', error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  }, [selectedNotebook?.title]);

  return { suggestedQuestions, isGeneratingSuggestions, generateSuggestions, generateDynamicSuggestions };
}
