// src/app/api/affiliate/register/route.ts
//
// POST /api/affiliate/register
// Chamada durante o signup quando ?ref=CODIGO está presente no URL.
// Associa o novo utilizador ao afiliado.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/api-auth';

const AFFILIATE_CODE_PATTERN = /^[A-Z0-9]{6,8}$/;

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    scope: 'affiliate:register',
    maxRequests: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const rawCode = (body as Record<string, unknown>)?.code;
  if (typeof rawCode !== 'string' || !AFFILIATE_CODE_PATTERN.test(rawCode.trim().toUpperCase())) {
    return NextResponse.json({ error: 'Código de afiliado inválido' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: registered, error } = await supabase.rpc('register_affiliate_referral', {
    p_new_user_id: user.id,
    p_affiliate_code: rawCode.trim().toUpperCase(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, registered: registered ?? false });
}


// ─────────────────────────────────────────────────────────────────────────────
// src/app/api/affiliate/payout/route.ts
//
// POST /api/affiliate/payout  (admin only)
// Admin processa o pagamento de comissões ao afiliado.

export const dynamic = 'force-dynamic';
