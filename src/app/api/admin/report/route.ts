import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';

async function makeSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }); },
        remove(name: string, options: any) { cookieStore.delete({ name, ...options }); },
      },
    }
  );
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof makeSupabase>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return null;
  return user;
}

function parsePeriod(rawMonth: string | null, rawYear: string | null) {
  const month = Number(rawMonth);
  const year = Number(rawYear);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return null;
  return { month, year };
}

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:report:get', maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const period = parsePeriod(searchParams.get('month'), searchParams.get('year'));
  if (!period) return NextResponse.json({ error: 'Período inválido' }, { status: 400 });

  const { data, error } = await supabase
    .from('monthly_reports')
    .select('*')
    .eq('period_month', period.month)
    .eq('period_year', period.year)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? null);
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:report:post', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const body = await req.json();
  const period = parsePeriod(String(body?.month ?? ''), String(body?.year ?? ''));
  if (!period) return NextResponse.json({ error: 'Período inválido' }, { status: 400 });

  const { error } = await supabase.rpc('generate_monthly_report', {
    p_month: period.month,
    p_year: period.year,
    p_rate: 64.05,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
