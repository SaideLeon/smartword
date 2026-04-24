// src/app/api/admin/invite/route.ts
//
// POST /api/admin/invite
// Envia e-mails de convite para uma lista de destinatários.
//
// Usa o Resend (https://resend.com) como fornecedor de e-mail.
// Se a variável RESEND_API_KEY não estiver configurada, a rota
// devolve um erro claro em vez de falhar silenciosamente.
//
// Para usar outro fornecedor (SendGrid, Mailgun, SMTP via Nodemailer),
// substitui apenas a função sendEmail() abaixo.

import { NextResponse } from 'next/server';
import { renderMuneriInviteEmail } from '@/emails/MuneriInviteEmail';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';

// ── Limites de segurança ────────────────────────────────────────────────────

const MAX_EMAILS_PER_REQUEST = 50;       // máx. destinatários por chamada
const MAX_SUBJECT_CHARS      = 150;
const MAX_BODY_CHARS         = 20_000;
const EMAIL_REGEX            = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Verificação de admin ────────────────────────────────────────────────────

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: Record<string, unknown>) =>
          cookieStore.set({ name, value, ...(options as object) }),
        remove: (name: string, options: Record<string, unknown>) =>
          cookieStore.delete({ name, ...(options as object) }),
      },
    },
  );

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

// ── Envio de e-mail via Resend ──────────────────────────────────────────────
//
// Para usar SendGrid: substituir pelo SDK @sendgrid/mail
// Para usar SMTP: substituir por Nodemailer

async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
  from?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Modo de desenvolvimento: simular envio
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[invite] Modo DEV — e-mail simulado para: ${params.to}`);
      console.info(`[invite] Assunto: ${params.subject}`);
      return { ok: true };
    }
    return { ok: false, error: 'RESEND_API_KEY não configurada.' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from ?? process.env.INVITE_FROM_EMAIL ?? 'Muneri <suporte@muneri.nativespeak.app>',
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
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Erro de rede ao enviar e-mail.' };
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Rate limit: 10 envios por minuto por admin
  const limited = await enforceRateLimit(req, {
    scope: 'admin:invite:post',
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  // Verificar admin
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  // Validar payload
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;

  // Validar e-mails
  if (!Array.isArray(payload.emails) || payload.emails.length === 0) {
    return NextResponse.json({ error: 'Lista de e-mails obrigatória' }, { status: 400 });
  }

  const rawEmails = payload.emails as unknown[];
  if (rawEmails.length > MAX_EMAILS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Máximo de ${MAX_EMAILS_PER_REQUEST} destinatários por envio` },
      { status: 400 },
    );
  }

  const validEmails: string[] = [];
  const invalidEmails: string[] = [];

  for (const em of rawEmails) {
    if (typeof em !== 'string') { invalidEmails.push(String(em)); continue; }
    const trimmed = em.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) { invalidEmails.push(trimmed); continue; }
    validEmails.push(trimmed);
  }

  if (validEmails.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum e-mail válido encontrado', invalid: invalidEmails },
      { status: 400 },
    );
  }

  // Validar assunto
  const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  if (!subject || subject.length > MAX_SUBJECT_CHARS) {
    return NextResponse.json(
      { error: `Assunto obrigatório (máx. ${MAX_SUBJECT_CHARS} chars)` },
      { status: 400 },
    );
  }

  // Validar corpo
  const emailBody = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!emailBody || emailBody.length > MAX_BODY_CHARS) {
    return NextResponse.json(
      { error: `Corpo do e-mail obrigatório (máx. ${MAX_BODY_CHARS} chars)` },
      { status: 400 },
    );
  }

  const emailHtml = renderMuneriInviteEmail({ body: emailBody });

  // Enviar e-mails (sequencialmente para não sobrecarregar o fornecedor)
  const results: Array<{ email: string; ok: boolean; error?: string }> = [];

  for (const to of validEmails) {
    const result = await sendEmail({ to, subject, text: emailBody, html: emailHtml });
    results.push({ email: to, ...result });

    // Pequena pausa entre envios para respeitar rate limits do fornecedor
    if (validEmails.indexOf(to) < validEmails.length - 1) {
      await new Promise(r => setTimeout(r, 120));
    }
  }

  const sent   = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);

  // Registar na auditoria
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: () => {},
          remove: () => {},
        },
      },
    );

    await supabase.from('audit_log').insert({
      actor_id: user.id,
      action: 'admin_invite_sent',
      resource: 'email',
      metadata: {
        sent,
        failed: failed.length,
        invalid: invalidEmails,
        subject,
        recipients: validEmails,
        sent_at: new Date().toISOString(),
      },
    });
  } catch { /* auditoria não crítica */ }

  return NextResponse.json({
    ok: true,
    sent,
    failed: failed.length,
    invalid: invalidEmails.length,
    details: failed.length > 0 ? failed : undefined,
  });
}
