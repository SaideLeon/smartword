import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { enforceRateLimit } from '@/lib/rate-limit';
import { hashPremiumAccessToken, validatePremiumLinkState } from '@/lib/admin-premium-links';

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

function extractClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  return req.headers.get('x-real-ip');
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const limited = await enforceRateLimit(req, {
    scope: 'premium:redeem:get',
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const params = await ctx.params;
  const token = decodeURIComponent(params.token || '').trim();
  if (token.length < 20 || token.length > 300) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 400 });
  }

  const tokenHash = hashPremiumAccessToken(token);
  const service = makeServiceSupabase();

  const { data: link, error: linkError } = await service
    .from('premium_access_links')
    .select('id,target_user_id,expires_at,revoked_at,uses_count,max_uses')
    .eq('token_hash', tokenHash)
    .single();

  if (linkError || !link) {
    return NextResponse.json({ error: 'Link não encontrado ou inválido.' }, { status: 404 });
  }

  const linkValidation = validatePremiumLinkState(link);
  if (!linkValidation.ok) {
    return NextResponse.json({ error: `Link indisponível (${linkValidation.reason}).` }, { status: 410 });
  }

  const { data: targetProfile, error: targetError } = await service
    .from('profiles')
    .select('id,role')
    .eq('id', link.target_user_id)
    .single();

  if (targetError || !targetProfile) {
    return NextResponse.json({ error: 'Utilizador alvo não encontrado.' }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const clientIp = extractClientIp(req);
  const userAgent = req.headers.get('user-agent');

  const { error: updateLinkError } = await service
    .from('premium_access_links')
    .update({
      uses_count: link.uses_count + 1,
      last_used_at: nowIso,
      last_used_ip: clientIp,
      last_used_user_agent: userAgent,
    })
    .eq('id', link.id)
    .eq('uses_count', link.uses_count);

  if (updateLinkError) {
    return NextResponse.json({ error: 'Este link já foi utilizado.' }, { status: 409 });
  }

  const { error: premiumError } = await service
    .from('profiles')
    .update({
      plan_key: 'premium',
      payment_status: 'active',
      updated_at: nowIso,
    })
    .eq('id', targetProfile.id);

  if (premiumError) {
    return NextResponse.json({ error: 'Falha ao ativar premium.' }, { status: 500 });
  }

  await service.from('audit_log').insert({
    actor_id: targetProfile.id,
    action: 'premium_link_redeemed',
    resource: 'premium_access_links',
    metadata: {
      premium_link_id: link.id,
      target_user_id: targetProfile.id,
      target_role_before: targetProfile.role,
      grants_admin: false,
      redeemed_at: nowIso,
      used_ip: clientIp,
      used_user_agent: userAgent,
    },
  });

  return NextResponse.json({
    ok: true,
    message: 'Acesso premium ativado com sucesso.',
    target_user_id: targetProfile.id,
    grants_admin: false,
  });
}
