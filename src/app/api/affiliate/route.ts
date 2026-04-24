// src/app/api/affiliate/route.ts
//
// GET  /api/affiliate          → buscar dados do dashboard do afiliado autenticado
// POST /api/affiliate          → gerar/obter código de afiliado
// GET  /api/affiliate?referrals=true  → listar utilizadores convidados + comissões

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth } from '@/lib/api-auth';

function generateAffiliateCode(size = 7) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

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
  let affiliate: Record<string, unknown> | null = null;
  let code: string | null = null;

  const { data: existingAffiliate, error: existingError } = await supabase
    .from('affiliates')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingAffiliate?.code) {
    affiliate = existingAffiliate;
    code = String(existingAffiliate.code);
  } else {
    const { data: rpcCode, error: rpcError } = await supabase
      .rpc('get_or_create_affiliate_code', { p_user_id: user.id });

    if (!rpcError && typeof rpcCode === 'string' && rpcCode.trim()) {
      code = rpcCode.trim().toUpperCase();
      const { data: byRpcAffiliate, error: byRpcError } = await supabase
        .from('affiliates')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (byRpcError) {
        return NextResponse.json({ error: byRpcError.message }, { status: 500 });
      }

      affiliate = byRpcAffiliate;
    } else {
      // Fallback para ambientes sem RPC/migração (produção parcial)
      for (let attempt = 0; attempt < 8 && !affiliate; attempt += 1) {
        const candidateCode = generateAffiliateCode();
        const { data: inserted, error: insertError } = await supabase
          .from('affiliates')
          .insert({
            user_id: user.id,
            code: candidateCode,
          })
          .select('*')
          .single();

        if (!insertError && inserted) {
          affiliate = inserted;
          code = candidateCode;
          break;
        }

        // Já existe afiliado para esse user (corrida) -> reaproveitar registro.
        if (insertError?.code === '23505') {
          const { data: racedAffiliate, error: racedError } = await supabase
            .from('affiliates')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          if (racedError) {
            return NextResponse.json({ error: racedError.message }, { status: 500 });
          }
          if (racedAffiliate) {
            affiliate = racedAffiliate;
            code = String(racedAffiliate.code ?? candidateCode);
            break;
          }
        }
      }

      if (!affiliate || !code) {
        return NextResponse.json(
          { error: 'Não foi possível gerar o código de afiliado neste momento.' },
          { status: 500 },
        );
      }
    }
  }

  const appUrl = process.env.APP_URL ?? 'https://muneri.nativespeak.app';

  return NextResponse.json({
    code,
    affiliate,
    link: `${appUrl}/auth/signup?ref=${code}`,
  });
}
