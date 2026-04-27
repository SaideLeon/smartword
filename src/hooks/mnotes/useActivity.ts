import { useAppStore } from '@/store/app-store';
import { ActivityItem } from '@/types';

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
