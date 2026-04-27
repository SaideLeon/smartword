import { useAppStore } from '@/store/app-store';
import { ActivityItem } from '@/types';
import { supabaseClient } from '@/hooks/useAuth';

export function useActivity() {
  const { addActivity, selectedNotebook } = useAppStore();

  const logActivity = (type: ActivityItem['type'], title: string, metadata?: string) => {
    const newItem: ActivityItem = {
      id: crypto.randomUUID(),
      type,
      title,
      timestamp: new Date(),
      metadata,
    };

    addActivity(newItem);

    void supabaseClient.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;

      await supabaseClient.from('mnotes_activity_history').insert({
        user_id: data.user.id,
        notebook_id: selectedNotebook?.id ?? null,
        activity_type: type,
        title,
        metadata: metadata ?? null,
      });
    }).catch((error) => {
      console.warn('Não foi possível persistir atividade do MNotes no Supabase:', error);
    });
  };

  return { logActivity };
}
