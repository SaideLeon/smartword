import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';

const ALLOWED_CATEGORIES = ['groq_api', 'supabase', 'hosting', 'domain', 'other'] as const;
const MAX_EXPENSE_MZN = 1_000_000;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseExpensePayload(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Record<string, unknown>;
  const category = payload.category;
  const description = payload.description;
  const amountMzn = payload.amount_mzn;
  const periodMonth = payload.period_month;
  const periodYear = payload.period_year;

  if (!ALLOWED_CATEGORIES.includes(category as typeof ALLOWED_CATEGORIES[number])) return null;
  if (typeof description !== 'string') return null;
  if (typeof amountMzn !== 'number' || Number.isNaN(amountMzn) || amountMzn < 0 || amountMzn > MAX_EXPENSE_MZN) return null;
  if (typeof periodMonth !== 'number' || !Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > 12) return null;
  if (typeof periodYear !== 'number' || !Number.isInteger(periodYear) || periodYear < 2020 || periodYear > 2100) return null;

  const normalizedDescription = description.trim().slice(0, 500);
  if (!normalizedDescription) return null;

  return {
    category,
    description: normalizedDescription,
    amount_mzn: amountMzn,
    period_month: periodMonth,
    period_year: periodYear,
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
  if (!id || !UUID_V4_PATTERN.test(id)) {
    return NextResponse.json({ error: 'id inválido ou ausente' }, { status: 400 });
  }

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
  if (!id || !UUID_V4_PATTERN.test(id)) {
    return NextResponse.json({ error: 'id inválido ou ausente' }, { status: 400 });
  }

  const { error } = await supabase.from('expense_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
