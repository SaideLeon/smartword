import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DeleteUsersInput = {
  userIds: string[];
};

async function makeSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.delete({ name, ...options });
        },
      },
    },
  );
}

function makeServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL não configurado');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof makeSupabase>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return null;
  return user;
}

function parseDeleteInput(body: unknown): DeleteUsersInput | null {
  if (!body || typeof body !== 'object') return null;

  const payload = body as Record<string, unknown>;
  if (!Array.isArray(payload.user_ids)) return null;

  const userIds = payload.user_ids
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => UUID_V4_PATTERN.test(value));

  if (userIds.length < 1 || userIds.length > 100) return null;
  return { userIds: Array.from(new Set(userIds)) };
}

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:users:get', maxRequests: 60, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const adminUser = await requireAdmin(supabase);
  if (!adminUser) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim().slice(0, 120);

  let query = supabase
    .from('profiles')
    .select('id,email,full_name,role,plan_key,payment_status,created_at')
    .neq('id', adminUser.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (q.length >= 2) {
    const escaped = q.replace(/[,()%]/g, '').replace(/\*/g, '').trim();
    query = query.or(`email.ilike.%${escaped}%,full_name.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function DELETE(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:users:delete', maxRequests: 8, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const adminUser = await requireAdmin(supabase);
  if (!adminUser) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const parsed = parseDeleteInput(await req.json());
  if (!parsed) {
    return NextResponse.json({ error: 'Payload inválido. Envie user_ids com UUIDs válidos.' }, { status: 400 });
  }

  if (parsed.userIds.includes(adminUser.id)) {
    return NextResponse.json({ error: 'Não é permitido eliminar a própria conta de admin.' }, { status: 400 });
  }

  const serviceSupabase = makeServiceSupabase();

  const { data: targets, error: targetsError } = await serviceSupabase
    .from('profiles')
    .select('id,role')
    .in('id', parsed.userIds);

  if (targetsError) return NextResponse.json({ error: targetsError.message }, { status: 500 });

  const foundIds = new Set((targets ?? []).map((row) => row.id));
  const missingIds = parsed.userIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    return NextResponse.json({ error: 'Alguns utilizadores não foram encontrados.', missing_ids: missingIds }, { status: 404 });
  }

  const containsAdmin = (targets ?? []).some((row) => row.role === 'admin');
  if (containsAdmin) {
    return NextResponse.json({ error: 'Não é permitido eliminar outras contas de admin por esta rota.' }, { status: 400 });
  }

  const deletedIds: string[] = [];
  const failures: Array<{ user_id: string; error: string }> = [];

  for (const userId of parsed.userIds) {
    try {
      const { error: deleteTccError } = await serviceSupabase.from('tcc_sessions').delete().eq('user_id', userId);
      if (deleteTccError) throw new Error(`Falha ao eliminar tcc_sessions: ${deleteTccError.message}`);

      const { error: deleteWorkError } = await serviceSupabase.from('work_sessions').delete().eq('user_id', userId);
      if (deleteWorkError) throw new Error(`Falha ao eliminar work_sessions: ${deleteWorkError.message}`);

      const { error: deleteUserError } = await serviceSupabase.auth.admin.deleteUser(userId, false);
      if (deleteUserError) throw new Error(`Falha ao eliminar auth.users: ${deleteUserError.message}`);

      deletedIds.push(userId);
    } catch (error) {
      failures.push({ user_id: userId, error: error instanceof Error ? error.message : 'Erro desconhecido' });
    }
  }

  if (failures.length > 0) {
    return NextResponse.json({
      ok: false,
      deleted_ids: deletedIds,
      failures,
    }, { status: 207 });
  }

  return NextResponse.json({ ok: true, deleted_ids: deletedIds });
}
