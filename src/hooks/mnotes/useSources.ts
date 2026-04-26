import { useAppStore } from '@/store/mnotes/app-store';
import { Source } from '@/types/mnotes';
import { useActivity } from './useActivity';

export function useSources() {
  const { sources, setSources, addSource } = useAppStore();
  const { logActivity } = useActivity();

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
        selected: true
      };
      addSource(newSource);
      logActivity('source_added', file.name);
    };
    reader.readAsDataURL(file);
  };

  const addTextSource = (title: string, text: string) => {
    const newSource: Source = {
      id: crypto.randomUUID(),
      name: title.endsWith('.txt') ? title : `${title}.txt`,
      type: 'text',
      data: btoa(unescape(encodeURIComponent(text))), // Base64 encode the text
      selected: true
    };
    addSource(newSource);
    logActivity('source_added', newSource.name);
  };

  const toggleSourceSelection = (id: string) => {
    const updated = sources.map(s => s.id === id ? { ...s, selected: !s.selected } : s);
    setSources(updated);
  };

  return { 
    handleFileUpload, 
    addTextSource, 
    toggleSourceSelection 
  };
}
