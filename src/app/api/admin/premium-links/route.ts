import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generatePremiumAccessToken, hashPremiumAccessToken } from '@/lib/admin-premium-links';

const MAX_LINK_VALIDITY_DAYS = 180;

type CreatePremiumLinkInput = {
  target_user_id: string;
  expires_at?: string | null;
  max_uses?: number;
  send_email?: boolean;
  email_subject?: string;
  email_body?: string;
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
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...(options as object) });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.delete({ name, ...(options as object) });
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return null;
  return user;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') return { ok: true };
    return { ok: false, error: 'RESEND_API_KEY não configurada.' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.INVITE_FROM_EMAIL ?? 'Muneri <suporte@muneri.nativespeak.app>',
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.message ?? `Resend HTTP ${res.status}` };
  }

  return { ok: true };
}

function parseInput(body: unknown): CreatePremiumLinkInput | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Record<string, unknown>;

  if (typeof payload.target_user_id !== 'string' || payload.target_user_id.trim().length < 10) {
    return null;
  }

  const input: CreatePremiumLinkInput = {
    target_user_id: payload.target_user_id.trim(),
  };

  if (payload.expires_at === null || typeof payload.expires_at === 'string') {
    input.expires_at = payload.expires_at;
  }

  if (typeof payload.max_uses === 'number') {
    input.max_uses = Math.floor(payload.max_uses);
  }

  if (typeof payload.send_email === 'boolean') {
    input.send_email = payload.send_email;
  }

  if (typeof payload.email_subject === 'string') {
    input.email_subject = payload.email_subject;
  }

  if (typeof payload.email_body === 'string') {
    input.email_body = payload.email_body;
  }

  return input;
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    scope: 'admin:premium-link:create',
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const admin = await requireAdmin(supabase);
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const payload = parseInput(await req.json().catch(() => null));
  if (!payload) return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });

  const maxUses = payload.max_uses ?? 1;
  if (maxUses < 1 || maxUses > 10) {
    return NextResponse.json({ error: 'max_uses deve estar entre 1 e 10.' }, { status: 400 });
  }

  let expiresAt: string | null = null;
  if (payload.expires_at) {
    const parsed = new Date(payload.expires_at);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'expires_at inválido.' }, { status: 400 });
    }

    if (parsed.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'expires_at deve estar no futuro.' }, { status: 400 });
    }

    const maxDate = new Date(Date.now() + MAX_LINK_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    if (parsed.getTime() > maxDate.getTime()) {
      return NextResponse.json({ error: `Validade máxima é ${MAX_LINK_VALIDITY_DAYS} dias.` }, { status: 400 });
    }

    expiresAt = parsed.toISOString();
  }

  const service = makeServiceSupabase();

  const { data: targetProfile, error: targetError } = await service
    .from('profiles')
    .select('id,email,role')
    .eq('id', payload.target_user_id)
    .single();

  if (targetError || !targetProfile) {
    return NextResponse.json({ error: 'Utilizador alvo não encontrado.' }, { status: 404 });
  }

  const rawToken = generatePremiumAccessToken();
  const tokenHash = hashPremiumAccessToken(rawToken);

  const { data: created, error: createError } = await service
    .from('premium_access_links')
    .insert({
      token_hash: tokenHash,
      target_user_id: targetProfile.id,
      created_by: admin.id,
      expires_at: expiresAt,
      max_uses: maxUses,
    })
    .select('id,expires_at,max_uses,created_at')
    .single();

  if (createError || !created) {
    return NextResponse.json({ error: createError?.message ?? 'Falha ao gerar link premium.' }, { status: 500 });
  }

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const redeemLink = `${appBaseUrl}/api/premium/redeem/${encodeURIComponent(rawToken)}`;

  let emailStatus: { ok: boolean; error?: string } | null = null;
  if (payload.send_email) {
    if (!targetProfile.email) {
      return NextResponse.json({ error: 'Utilizador alvo não possui e-mail.' }, { status: 400 });
    }

    const subject = payload.email_subject?.trim() || 'Muneri · Link de acesso Premium';
    const body = (payload.email_body?.trim() || 'Olá! Usa este link para ativar o teu acesso premium no Muneri:')
      .slice(0, 10_000);

    const fullText = `${body}\n\n${redeemLink}`;
    const fullHtml = `<p>${body.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p><p><a href="${redeemLink}">${redeemLink}</a></p>`;
    emailStatus = await sendEmail({
      to: targetProfile.email,
      subject: subject.slice(0, 150),
      text: fullText,
      html: fullHtml,
    });
  }

  await service.from('audit_log').insert({
    actor_id: admin.id,
    action: 'admin_premium_link_created',
    resource: 'premium_access_links',
    metadata: {
      premium_link_id: created.id,
      target_user_id: targetProfile.id,
      target_user_role: targetProfile.role,
      expires_at: created.expires_at,
      max_uses: created.max_uses,
      email_sent: emailStatus?.ok ?? false,
      email_error: emailStatus?.error ?? null,
      created_at: created.created_at,
    },
  });

  return NextResponse.json({
    ok: true,
    premium_link_id: created.id,
    target_user_id: targetProfile.id,
    expires_at: created.expires_at,
    max_uses: created.max_uses,
    redeem_link: redeemLink,
    email: emailStatus,
  });
}
