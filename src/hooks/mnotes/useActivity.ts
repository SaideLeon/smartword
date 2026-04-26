import { useAppStore } from '@/store/mnotes/app-store';
import { ActivityItem } from '@/types/mnotes';

export function useActivity() {
  const { addActivity } = useAppStore();

  const logActivity = (type: ActivityItem['type'], title: string, metadata?: string) => {
    const newItem: ActivityItem = {
      id: crypto.randomUUID(),
      type,
      title,
      timestamp: new Date(),
      metadata
    };
    addActivity(newItem);
  };

  return { logActivity };
}
