# DocumentPreview.tsx — Patch Muneri (4 substituições cirúrgicas)
# Aplica estas substituições com str_replace ou manualmente no teu editor.

# ── 1. Wrapper da secção ───────────────────────────────────────────────────────

ANTES:
  <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)]">

DEPOIS:
  <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--parchment)]">

# ── 2. Header interno da secção ───────────────────────────────────────────────

ANTES:
  <header className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-3 py-2">

DEPOIS:
  <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2">

# ── 3. Label "Canvas A4" ──────────────────────────────────────────────────────

ANTES:
  <h3 className="mono text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Canvas A4</h3>

DEPOIS:
  <h3 className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">Canvas A4</h3>

# ── 4. Label "Paginação automática" ──────────────────────────────────────────

ANTES:
  <span className="mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Paginação automática</span>

DEPOIS:
  <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--muted)]">Paginação automática</span>

# Nota: o conteúdo das páginas A4 (bg-white, text-[#111]) mantém-se intacto — é
# intencional para simular papel físico, independentemente do tema da UI.
