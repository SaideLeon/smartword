// src/app/api/affiliate/route.ts
//
// GET  /api/affiliate          → buscar dados do dashboard do afiliado autenticado
// POST /api/affiliate          → gerar/obter código de afiliado
// GET  /api/affiliate?referrals=true  → listar utilizadores convidados + comissões

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/api-auth';

// ── GET: Dashboard do afiliado ────────────────────────────────────────────────

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, {
    scope: 'affiliate:get',
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const wantsReferrals = searchParams.get('referrals') === 'true';

  // 1. Dados do afiliado
  const { data: affiliate, error: affError } = await supabase
    .from('affiliates')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (affError) {
    return NextResponse.json({ error: affError.message }, { status: 500 });
  }

  if (!affiliate) {
    return NextResponse.json({ exists: false, affiliate: null }, { status: 200 });
  }

  // 2. Se pediu referrals, incluir lista detalhada
  if (wantsReferrals) {
    const { data: referrals, error: refError } = await supabase
      .from('affiliate_referrals')
      .select(`
        id,
        status,
        registered_at,
        converted_at,
        referred_user:profiles!affiliate_referrals_referred_user_id_fkey (
          id,
          full_name,
          email,
          plan_key,
          created_at
        ),
        commissions:affiliate_commissions (
          id,
          payment_amount_mzn,
          commission_mzn,
          commission_rate,
          status,
          created_at
        )
      `)
      .eq('affiliate_id', affiliate.id)
      .order('registered_at', { ascending: false });

    if (refError) {
      return NextResponse.json({ error: refError.message }, { status: 500 });
    }

    return NextResponse.json({
      exists: true,
      affiliate,
      referrals: referrals ?? [],
    });
  }

  // 3. Últimas comissões (sem pedir referrals)
  const { data: recentCommissions } = await supabase
    .from('affiliate_commissions')
    .select(`
      id,
      payment_amount_mzn,
      commission_mzn,
      commission_rate,
      status,
      created_at,
      referral:affiliate_referrals!affiliate_commissions_referral_id_fkey (
        referred_user:profiles!affiliate_referrals_referred_user_id_fkey (
          full_name,
          email
        )
      )
    `)
    .eq('affiliate_id', affiliate.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    exists: true,
    affiliate,
    recentCommissions: recentCommissions ?? [],
  });
}

// ── POST: Gerar ou obter código de afiliado ───────────────────────────────────

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    scope: 'affiliate:post',
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const supabase = await createClient();

  const { data: code, error } = await supabase
    .rpc('get_or_create_affiliate_code', { p_user_id: user.id });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const appUrl = process.env.APP_URL ?? 'https://muneri.nativespeak.app';

  return NextResponse.json({
    code,
    affiliate,
    link: `${appUrl}/auth/signup?ref=${code}`,
  });
}
