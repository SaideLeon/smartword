import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export type ApiAuthResult =
  | { user: { id: string }; error: null }
  | { user: null; error: NextResponse };

export async function requireAuth(): Promise<ApiAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
    };
  }

  return { user: { id: user.id }, error: null };
}

export async function requireFeatureAccess(
  userId: string,
  feature: 'cover' | 'ai_chat' | 'export_full' | 'tcc' | 'create_work',
): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: hasAccess, error } = await supabase.rpc('check_user_access', {
    p_user_id: userId,
    p_feature: feature,
  });

  if (error || !hasAccess) {
    return NextResponse.json(
      { error: 'Plano insuficiente para esta funcionalidade.' },
      { status: 403 },
    );
  }

  return null;
}
