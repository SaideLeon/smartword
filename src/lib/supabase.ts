// src/lib/supabase.ts
//
// Cliente Supabase para uso SERVER-SIDE (API routes, Server Components).
// Usa @supabase/ssr para criar um cliente autenticado via cookies da sessão,
// o que permite que as políticas RLS com auth.uid() funcionem correctamente.
//
// NUNCA importar este ficheiro em componentes cliente ('use client').
// Para o cliente browser, usa o supabaseClient exportado por src/hooks/useAuth.ts.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cria um cliente Supabase autenticado para uso em API routes e Server Components.
 * Lê automaticamente o JWT da sessão a partir dos cookies do pedido,
 * garantindo que as políticas RLS com auth.uid() são respeitadas.
 *
 * Uso:
 *   const supabase = await createClient();
 *   const { data } = await supabase.from('tcc_sessions').select('*');
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Em Server Components o set não é possível — ignorar silenciosamente.
            // Em API routes funciona normalmente.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.delete({ name, ...options });
          } catch {
            // Idem ao set.
          }
        },
      },
    },
  );
}

/**
 * Obtém o utilizador autenticado actual.
 * Retorna null se não houver sessão activa.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Obtém o user_id do utilizador autenticado actual.
 * Lança erro se não houver sessão (útil em funções que exigem auth).
 */
export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Utilizador não autenticado');
  return user.id;
}
