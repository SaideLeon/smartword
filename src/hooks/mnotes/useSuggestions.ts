import { useAppStore } from '@/store/mnotes/app-store';
import { Source } from '@/types/mnotes';
import { useState } from 'react';
import { NotebookService } from '@/services/mnotes/notebook.service';

export function useSuggestions() {
  const { setIsLoading } = useAppStore();
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  const generateSuggestions = async (currentSources: Source[]) => {
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
  };

  return { suggestedQuestions, isGeneratingSuggestions, generateSuggestions };
}
