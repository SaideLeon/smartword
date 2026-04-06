import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';

const ALLOWED_CATEGORIES = ['groq_api', 'supabase', 'hosting', 'domain', 'other'] as const;

function parseExpensePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Record<string, unknown>;

  if (!ALLOWED_CATEGORIES.includes(payload.category as typeof ALLOWED_CATEGORIES[number])) return null;
  if (typeof payload.description !== 'string') return null;
  if (typeof payload.amount_mzn !== 'number' || Number.isNaN(payload.amount_mzn) || payload.amount_mzn < 0) return null;
  if (!Number.isInteger(payload.period_month) || payload.period_month < 1 || payload.period_month > 12) return null;
  if (!Number.isInteger(payload.period_year) || payload.period_year < 2020 || payload.period_year > 2100) return null;

  const description = payload.description.trim().slice(0, 500);
  if (!description) return null;

  return {
    category: payload.category,
    description,
    amount_mzn: payload.amount_mzn,
    period_month: payload.period_month,
    period_year: payload.period_year,
  };
}

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

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:expenses:get', maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { data, error } = await supabase
    .from('expense_items')
    .select('id, category, description, amount_mzn, period_month, period_year')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:expenses:post', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const parsed = parseExpensePayload(await req.json());
  if (!parsed) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });

  const { data, error } = await supabase
    .from('expense_items')
    .insert({ created_by: user.id, ...parsed })
    .select('id, category, description, amount_mzn, period_month, period_year')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:expenses:patch', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const parsed = parseExpensePayload(await req.json());
  if (!parsed) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });

  const { data, error } = await supabase
    .from('expense_items')
    .update(parsed)
    .eq('id', id)
    .select('id, category, description, amount_mzn, period_month, period_year')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:expenses:delete', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const { error } = await supabase.from('expense_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
