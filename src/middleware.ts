// src/middleware.ts
// Protege rotas que exigem autenticação.
// /app, /admin → requer login
// /admin       → requer role 'admin'

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string)                    { return request.cookies.get(name)?.value; },
        set(name: string, value: string, o: any) { response.cookies.set({ name, value, ...o }); },
        remove(name: string, o: any)         { response.cookies.delete({ name, ...o }); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Rotas públicas — deixar passar
  if (
    pathname.startsWith('/auth') ||
    pathname === '/' ||
    pathname.startsWith('/landing') ||
    pathname.startsWith('/planos')
  ) {
    return response;
  }

  // Rota /app → exige login
  if (pathname.startsWith('/app') && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Rota /admin → exige login + role admin
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/app', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};
