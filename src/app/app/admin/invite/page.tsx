'use client';

import { useState, useCallback } from 'react';
import { useThemeMode } from '@/hooks/useThemeMode';
import Link from 'next/link';

// ── Assunto e corpo do e-mail pré-configurados ──────────────────────────────

const DEFAULT_SUBJECT =
  'Muneri · O teu trabalho académico em minutos — 5 dias de acesso ilimitado';

const DEFAULT_BODY = `Olá,

Sabemos que os trabalhos académicos consomem tempo que podias usar melhor.
Por isso criámos o Muneri — a plataforma que transforma o teu tema num trabalho
completo, formatado e pronto a entregar, em minutos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Como funciona em 3 passos simples:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Insere o tema do teu trabalho de campo
   Escreve o assunto que te foi atribuído — o sistema compreende qualquer área:
   Direito, Gestão, Saúde, Engenharia, Educação, Ciências Sociais, etc.

2. Indica o módulo / disciplina
   O Muneri usa esta informação para calibrar o tom académico, a terminologia
   correta e a estrutura exigida no teu curso.

3. Descarrega o trabalho completo
   O sistema gera automaticamente:
   ✔ Capa e contracapa personalizadas com o logótipo da tua instituição
   ✔ Sumário com numeração de página correcta
   ✔ Introdução, desenvolvimento por capítulos e conclusão
   ✔ Referências bibliográficas em norma APA
   ✔ Ficheiro Word (.docx) pronto a imprimir e submeter

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Porquê o Muneri é diferente:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

● Pensado para estudantes moçambicanos
  O sistema conhece o contexto local — usa exemplos, dados e referências
  relevantes para Moçambique e para o ensino superior africano.

● Não é apenas um gerador de texto
  É um assistente académico completo: gera o esboço, permite que o revises
  secção a secção, integra as tuas fontes de referência e adapta o conteúdo
  ao nível exigido.

● Exportação em Word nativa
  Compatível com qualquer computador, incluso sem Microsoft Word instalado.
  O ficheiro abre correctamente no Google Docs, LibreOffice e WPS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✨  ACESSO DE BOAS-VINDAS (5 DIAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ao criares a tua conta no Muneri, recebes automaticamente:

→ 5 dias de acesso ilimitado a todas as funcionalidades
→ Geração completa de trabalhos, TCC, chat IA, capa/contracapa e exportação integral

Como activar:
  1. Acede a https://muneri.nativespeak.app/auth/login
  2. Cria a tua conta (Google ou e-mail/senha)
  3. O período de 5 dias é activado automaticamente — sem cartão de crédito

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Experimenta gratuitamente em: https://muneri.nativespeak.app

Qualquer questão, responde a este e-mail — temos todo o gosto em ajudar.

Com os melhores cumprimentos,
Equipa Muneri
Quelimane, Moçambique
https://muneri.nativespeak.app`;

// ── Componente principal ─────────────────────────────────────────────────────

export default function AdminInvitePage() {
  const { themeMode } = useThemeMode();

  const dark = themeMode === 'dark';
  const themeVars = dark
    ? '[--ink:#f1e8da] [--parchment:#0f0e0d] [--surface:#141210] [--surface2:#1a1714] [--gold:#d4b37b] [--gold2:#c9a96e] [--muted:#c8bfb4] [--faint:#8a7d6e] [--dim:#5a5248] [--green:#6ea886] [--teal:#61aa9d] [--border:#2c2721] [--border2:#3a332a] [--red:#f87171]'
    : '[--ink:#0f0e0d] [--parchment:#f5f0e8] [--surface:#ece8df] [--surface2:#e5e0d5] [--gold:#c9a96e] [--gold2:#8b6914] [--muted:#6b6254] [--faint:#c4b8a4] [--dim:#a09585] [--green:#4a7c59] [--teal:#3a8a7a] [--border:#d8ceb8] [--border2:#c8baa0] [--red:#b91c1c]';

  const [emails, setEmails] = useState('');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const [sentCount, setSentCount] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);

  // Parsear lista de e-mails (separados por vírgula, ponto e vírgula ou nova linha)
  const parsedEmails = emails
    .split(/[\n,;]+/)
    .map(e => e.trim())
    .filter(e => e.includes('@') && e.includes('.'));

  const handleSend = useCallback(async () => {
    if (parsedEmails.length === 0) {
      setResultMessage('Insere pelo menos um e-mail válido.');
      setStatus('error');
      return;
    }
    if (!subject.trim()) {
      setResultMessage('O assunto não pode estar vazio.');
      setStatus('error');
      return;
    }
    if (!body.trim()) {
      setResultMessage('O corpo do e-mail não pode estar vazio.');
      setStatus('error');
      return;
    }

    setStatus('sending');
    setResultMessage('');

    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: parsedEmails,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? `Erro HTTP ${res.status}`);
      }

      setSentCount(data.sent ?? parsedEmails.length);
      setStatus('success');
      setResultMessage(`${data.sent ?? parsedEmails.length} convite(s) enviado(s) com sucesso.`);
      setEmails('');
    } catch (e: any) {
      setStatus('error');
      setResultMessage(e?.message ?? 'Falha ao enviar convites.');
    }
  }, [parsedEmails, subject, body]);

  const handleReset = () => {
    setSubject(DEFAULT_SUBJECT);
    setBody(DEFAULT_BODY);
    setStatus('idle');
    setResultMessage('');
  };

  return (
    <main className={`${themeVars} min-h-screen bg-[var(--parchment)] text-[var(--ink)]`}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">

        {/* ── Cabeçalho ── */}
        <header className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--faint)]">
                Muneri · Administração
              </p>
              <h1 className="mt-1.5 font-serif text-2xl leading-snug sm:text-3xl">
                Enviar <em className="text-[var(--gold2)]">convites</em>
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                Convida estudantes universitários para o Muneri com um e-mail personalizado e pré-configurado.
              </p>
            </div>
            <Link
              href="/admin"
              className="shrink-0 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
            >
              ← Painel
            </Link>
          </div>
        </header>

        {/* ── Feedback ── */}
        {status !== 'idle' && status !== 'sending' && (
          <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 font-mono text-[11px] ${
            status === 'success'
              ? 'border-[var(--green)]/40 bg-[var(--green)]/10 text-[var(--green)]'
              : 'border-[var(--red)]/40 bg-[var(--red)]/10 text-[var(--red)]'
          }`}>
            <span className="text-base leading-none">{status === 'success' ? '✓' : '⚠'}</span>
            <span>{resultMessage}</span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

          {/* ── Coluna esquerda: editor ── */}
          <div className="flex flex-col gap-5">

            {/* Campo: destinatários */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <label className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--faint)]">
                  Destinatários
                </label>
                {parsedEmails.length > 0 && (
                  <span className="rounded border border-[var(--border2)] bg-[var(--surface2)] px-2 py-0.5 font-mono text-[10px] text-[var(--gold2)]">
                    {parsedEmails.length} e-mail{parsedEmails.length > 1 ? 's' : ''} detectado{parsedEmails.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <textarea
                value={emails}
                onChange={e => setEmails(e.target.value)}
                rows={4}
                placeholder={`aluno@unisced.edu.mz\nprof@up.edu.mz, turma2025@uem.ac.mz\noutro@example.com`}
                className="w-full resize-y rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2.5 font-mono text-[12px] leading-[1.65] text-[var(--ink)] outline-none caret-[var(--gold2)] placeholder-[var(--faint)] transition focus:border-[var(--gold2)]"
              />
              <p className="mt-2 font-mono text-[10px] text-[var(--faint)]">
                Separa múltiplos endereços por vírgula, ponto e vírgula ou nova linha.
              </p>

              {/* Lista de e-mails detectados */}
              {parsedEmails.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {parsedEmails.map((em, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 rounded border border-[var(--border2)] bg-[var(--surface2)] px-2 py-0.5 font-mono text-[10px] text-[var(--muted)]"
                    >
                      {em.includes('.edu') && (
                        <span title="Conta educativa" className="text-[var(--green)]">🎓</span>
                      )}
                      {em}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Campo: assunto */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--faint)]">
                Assunto do e-mail
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2.5 font-mono text-[12px] text-[var(--ink)] outline-none caret-[var(--gold2)] placeholder-[var(--faint)] transition focus:border-[var(--gold2)]"
              />
              <p className="mt-1.5 font-mono text-[10px] text-[var(--faint)]">
                {subject.length}/150 caracteres
              </p>
            </section>

            {/* Campo: corpo */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-3 flex items-center justify-between">
                <label className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--faint)]">
                  Corpo do e-mail
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewMode(false)}
                    className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition ${!previewMode ? 'border-[var(--gold2)] text-[var(--gold2)]' : 'border-[var(--border)] text-[var(--faint)] hover:border-[var(--gold2)]'}`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(true)}
                    className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition ${previewMode ? 'border-[var(--gold2)] text-[var(--gold2)]' : 'border-[var(--border)] text-[var(--faint)] hover:border-[var(--gold2)]'}`}
                  >
                    Pré-visualizar
                  </button>
                </div>
              </div>

              {previewMode ? (
                <div className="min-h-[420px] overflow-auto whitespace-pre-wrap rounded border border-[var(--border)] bg-[var(--surface2)] px-4 py-4 font-mono text-[11px] leading-[1.8] text-[var(--muted)]">
                  {body}
                </div>
              ) : (
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={24}
                  className="w-full resize-y rounded border border-[var(--border)] bg-[var(--surface2)] px-3 py-2.5 font-mono text-[11px] leading-[1.8] text-[var(--ink)] outline-none caret-[var(--gold2)] placeholder-[var(--faint)] transition focus:border-[var(--gold2)]"
                />
              )}

              <div className="mt-2 flex items-center justify-between">
                <p className="font-mono text-[10px] text-[var(--faint)]">
                  {body.length} caracteres · {body.split('\n').length} linhas
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="font-mono text-[10px] text-[var(--faint)] underline underline-offset-2 transition hover:text-[var(--gold2)]"
                >
                  ↺ Restaurar texto original
                </button>
              </div>
            </section>
          </div>

          {/* ── Coluna direita: resumo e acções ── */}
          <aside className="flex flex-col gap-4">

            {/* Resumo do envio */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
                Resumo do envio
              </p>

              <div className="space-y-3">
                <Row label="Destinatários" value={parsedEmails.length > 0 ? `${parsedEmails.length} e-mail${parsedEmails.length > 1 ? 's' : ''}` : '—'} />
                <Row
                  label="Contas edu"
                  value={(() => {
                    const n = parsedEmails.filter(e => e.split('@')[1]?.split('.').includes('edu')).length;
                    return n > 0 ? `${n} 🎓` : '—';
                  })()}
                  highlight
                />
                <Row label="Assunto" value={subject.length > 0 ? `${subject.slice(0, 32)}…` : '—'} />
                <Row label="Corpo" value={body.length > 0 ? `${body.length} chars` : '—'} />
              </div>

              {/* Botão enviar */}
              <button
                type="button"
                onClick={handleSend}
                disabled={status === 'sending' || parsedEmails.length === 0}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'sending' ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border border-black/30 border-t-black" />
                    A enviar…
                  </>
                ) : (
                  <>
                    <span>✉</span>
                    {parsedEmails.length > 0
                      ? `Enviar ${parsedEmails.length} convite${parsedEmails.length > 1 ? 's' : ''}`
                      : 'Enviar convites'}
                  </>
                )}
              </button>

              {parsedEmails.length === 0 && (
                <p className="mt-2 text-center font-mono text-[10px] text-[var(--faint)]">
                  Insere pelo menos um e-mail para enviar.
                </p>
              )}
            </div>

            {/* Benefícios que o e-mail comunica */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
                O e-mail comunica
              </p>
              <ul className="space-y-2.5 text-[12px] text-[var(--muted)]">
                {[
                  ['✦', 'Como gerar trabalho completo a partir do tema'],
                  ['✦', 'Inserção do módulo/disciplina para calibrar tom académico'],
                  ['✦', 'Geração automática de capa + contracapa personalizada'],
                  ['✦', 'Exportação em Word compatível com qualquer leitor'],
                  ['✦', 'Contexto moçambicano nas referências e exemplos'],
                  ['✨', '5 dias de acesso ilimitado para novas contas'],
                ].map(([icon, text], i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 text-[11px] ${icon === '🎓' ? '' : 'text-[var(--gold2)]'}`}>{icon}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Destaque: condição do acesso de boas-vindas */}
            <div className="rounded-xl border border-[var(--green)]/40 bg-[var(--green)]/8 p-5">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--green)]">
                ✨ Condição do acesso de boas-vindas
              </p>
              <div className="space-y-2 font-mono text-[10px] leading-[1.65] text-[var(--muted)]">
                <p className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--green)]">✓</span>
                  <span>Novas contas (Google OAuth ou e-mail/senha)</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--faint)]">ℹ</span>
                  <span>Após 5 dias, aplicam-se os limites do plano activo</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--faint)]">ℹ</span>
                  <span>Não depende de domínio educativo (.edu)</span>
                </p>
                <p className="mt-3 rounded border border-[var(--green)]/20 bg-[var(--green)]/5 px-2.5 py-2 text-[var(--green)]">
                  O benefício é concedido <strong>automaticamente</strong> e apenas
                  <strong> uma vez</strong> por conta.
                </p>
              </div>
            </div>

            {/* Histórico de envios (placeholder) */}
            {sentCount > 0 && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
                  Última sessão de envio
                </p>
                <p className="font-mono text-sm text-[var(--green)]">
                  ✓ {sentCount} convite{sentCount > 1 ? 's' : ''} enviado{sentCount > 1 ? 's' : ''}
                </p>
                <p className="mt-1 font-mono text-[10px] text-[var(--faint)]">
                  {new Date().toLocaleString('pt-PT')}
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

// ── Sub-componente: linha de resumo ──────────────────────────────────────────

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] text-[var(--faint)]">{label}</span>
      <span className={`font-mono text-[11px] ${highlight ? 'text-[var(--green)]' : 'text-[var(--muted)]'}`}>
        {value}
      </span>
    </div>
  );
}
