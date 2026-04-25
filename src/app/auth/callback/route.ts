// src/app/auth/callback/route.ts
// Recebe o redirect do Google OAuth e troca o code por sessão.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function normalizeNext(next: string | null) {
  if (!next || !next.startsWith('/')) return '/app';
  return next;
}

function normalizeRef(rawRef: string | null) {
  const ref = rawRef?.trim().toUpperCase() ?? '';
  return /^[A-Z0-9]{6,8}$/.test(ref) ? ref : null;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = normalizeNext(searchParams.get('next'));
  const ref = normalizeRef(searchParams.get('ref'));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      if (ref) {
        response.cookies.set('affiliate_ref_code', encodeURIComponent(ref), {
          path: '/',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
