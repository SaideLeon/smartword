'use client';

import { useCallback, useState } from 'react';
import type { Editor } from '@tiptap/react';

interface Props {
  editor: Editor | null;
  activeTab: string;
}

function MathDialog({ onInsert, onClose }: { onInsert: (latex: string, block: boolean) => void; onClose: () => void }) {
  const [input, setInput] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-[var(--border2)] bg-[var(--surface)] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[.15em] text-[var(--faint)]">Equação LaTeX</p>
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.shiftKey) { if (input.trim()) onInsert(input, true); }
            else if (e.key === 'Enter') { if (input.trim()) onInsert(input, false); }
            else if (e.key === 'Escape') onClose();
          }}
          placeholder="x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
          className="w-full rounded border border-[var(--border2)] bg-transparent px-3 py-2 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--gold2)]"
        />
        <p className="mt-1 font-mono text-[9px] text-[var(--faint)]">Enter = inline · Shift+Enter = bloco centrado</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => input.trim() && onInsert(input, false)} className="flex-1 rounded bg-gradient-to-br from-[var(--gold)] to-[var(--gold2)] py-2 font-mono text-[11px] font-bold text-black transition hover:brightness-110">Inline $…$</button>
          <button type="button" onClick={() => input.trim() && onInsert(input, true)} className="flex-1 rounded border border-[var(--border2)] py-2 font-mono text-[11px] text-[var(--muted)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]">Bloco $$…$$</button>
        </div>
      </div>
    </div>
  );
}

export function EditorRibbon({ editor, activeTab }: Props) {
  const [showMath, setShowMath] = useState(false);

  const insertMath = useCallback((latex: string, block: boolean) => {
    if (!editor) return;
    editor.chain().focus().insertContent(block ? `\n\n$$${latex}$$\n\n` : `$${latex}$`).run();
    setShowMath(false);
  }, [editor]);

  // Inline small ribbon button
  const Btn = ({ children, onClick, active = false, title, className = '' }: {
    children: React.ReactNode; onClick?: () => void; active?: boolean; title?: string; className?: string;
  }) => (
    <button
      type="button" title={title} onClick={onClick}
      className={`flex min-h-[22px] min-w-[24px] cursor-pointer items-center justify-center whitespace-nowrap rounded border border-transparent px-1.5 py-0.5 text-[11px] transition-all ${active ? 'bg-[var(--gold2)] text-black' : 'text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--ink)]'} ${className}`}
    >
      {children}
    </button>
  );

  // Big vertical ribbon button
  const BigBtn = ({ icon, label, onClick, title }: { icon: string; label: string; onClick?: () => void; title?: string }) => (
    <button
      type="button" title={title} onClick={onClick}
      className="flex min-w-[44px] cursor-pointer flex-col items-center gap-0.5 rounded border border-transparent px-1.5 py-1 text-[var(--muted)] transition-all hover:bg-[var(--border)] hover:text-[var(--ink)]"
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="font-mono text-[8px] leading-none">{label}</span>
    </button>
  );

  // Ribbon divider
  const Sep = () => <div className="mx-0.5 w-px self-stretch bg-[var(--border)]" />;

  // Ribbon group
  const Group = ({ children, label, minWidth = 'auto' }: { children: React.ReactNode; label: string; minWidth?: string | number }) => (
    <div className="relative flex flex-col items-center px-2" style={{ minWidth }}>
      <div className="flex flex-1 items-center gap-0.5">{children}</div>
      <p className="mt-auto pt-1 font-mono text-[9px] text-[var(--dim)] whitespace-nowrap">{label}</p>
      <div className="absolute bottom-2 right-0 top-2 w-px bg-[var(--border)]" />
    </div>
  );

  if (!editor) {
    return (
      <div className="flex h-[72px] shrink-0 items-center border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <span className="font-mono text-[10px] text-[var(--dim)]">A iniciar editor…</span>
      </div>
    );
  }

  const isBold = editor.isActive('bold');
  const isItalic = editor.isActive('italic');
  const isStrike = editor.isActive('strike');
  const isCode = editor.isActive('code');
  const isBulletList = editor.isActive('bulletList');
  const isOrderedList = editor.isActive('orderedList');
  const isBlockquote = editor.isActive('blockquote');
  const isH1 = editor.isActive('heading', { level: 1 });
  const isH2 = editor.isActive('heading', { level: 2 });
  const isH3 = editor.isActive('heading', { level: 3 });
  const isPara = editor.isActive('paragraph');

  return (
    <>
      {showMath && <MathDialog onInsert={insertMath} onClose={() => setShowMath(false)} />}

      <div
        className="flex h-[72px] shrink-0 items-stretch overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* ── Área de Transferência ── */}
        <Group label="Área de transferência" minWidth={86}>
          <BigBtn icon="📋" label="Colar" onClick={() => { try { document.execCommand('paste'); } catch {} editor.commands.focus(); }} title="Colar (Ctrl+V)" />
          <div className="flex flex-col gap-0.5">
            <Btn onClick={() => { try { document.execCommand('cut'); } catch {} }} title="Cortar">✂ Cortar</Btn>
            <Btn onClick={() => { try { document.execCommand('copy'); } catch {} }} title="Copiar">📄 Copiar</Btn>
          </div>
        </Group>

        {/* ── Tipo de letra ── */}
        <Group label="Tipo de letra" minWidth={230}>
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-center gap-1">
              <select
                className="w-28 cursor-pointer rounded border border-[var(--border2)] bg-[var(--surface2)] px-1 py-0.5 font-mono text-[11px] text-[var(--muted)] outline-none transition focus:border-[var(--gold2)]"
                defaultValue="Times New Roman"
              >
                <option>Times New Roman</option>
                <option>Arial</option>
                <option>Calibri</option>
                <option>Georgia</option>
                <option>Courier New</option>
              </select>
              <input
                type="number" defaultValue={12} min={8} max={72}
                className="w-9 rounded border border-[var(--border2)] bg-[var(--surface2)] px-1 py-0.5 text-center font-mono text-[11px] text-[var(--muted)] outline-none transition focus:border-[var(--gold2)]"
              />
              <Btn title="Aumentar fonte">A↑</Btn>
              <Btn title="Diminuir fonte">A↓</Btn>
              <Btn title="Limpar formatação" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>⌫</Btn>
            </div>
            <div className="flex items-center gap-0.5">
              <Btn active={isBold} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)" className="font-bold">B</Btn>
              <Btn active={isItalic} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)" className="italic">I</Btn>
              <Btn active={isStrike} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado"><s>S</s></Btn>
              <Btn active={isCode} onClick={() => editor.chain().focus().toggleCode().run()} title="Código inline" className="font-mono text-[10px]">C</Btn>
              <Sep />
              <Btn title="Cor do texto"><span className="border-b-2 border-red-400 px-0.5">A</span></Btn>
              <Btn title="Realce"><span className="bg-yellow-400/80 px-0.5 text-black">A</span></Btn>
            </div>
          </div>
        </Group>

        {/* ── Parágrafo ── */}
        <Group label="Parágrafo" minWidth={116}>
          <div className="flex flex-col gap-1">
            <div className="flex gap-0.5">
              <Btn active={isBulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista de marcadores">≡•</Btn>
              <Btn active={isOrderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">≡1</Btn>
              <Btn title="Recuar">⇤</Btn>
              <Btn title="Avançar">⇥</Btn>
              <Btn title="Marcas de parágrafo">¶</Btn>
            </div>
            <div className="flex gap-0.5">
              <Btn title="Alinhar à esquerda">⬛◻◻</Btn>
              <Btn title="Centrar">◻⬛◻</Btn>
              <Btn title="Alinhar à direita">◻◻⬛</Btn>
              <Btn title="Justificar">▬▬▬</Btn>
              <Btn title="Espaçamento entre linhas" className="text-[9px]">↕↕</Btn>
            </div>
          </div>
        </Group>

        {/* ── Estilos ── */}
        <Group label="Estilos" minWidth={168}>
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-start gap-1.5">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`cursor-pointer rounded border px-2 py-1 text-[14px] font-bold transition ${isH1 ? 'border-transparent bg-[var(--gold2)] text-black' : 'border-[var(--border2)] text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'}`}
              >
                Título 1
              </button>
              <div className="flex flex-col gap-0.5">
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`cursor-pointer rounded border px-2 py-0.5 text-[11px] transition ${isH2 ? 'border-transparent bg-[var(--gold2)] text-black' : 'border-[var(--border2)] text-[var(--muted)] hover:border-[var(--gold2)]'}`}>Subtítulo</button>
                <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className={`cursor-pointer rounded border px-2 py-0.5 text-[11px] transition ${isPara && !isH1 && !isH2 && !isH3 ? 'border-transparent bg-[var(--gold2)] text-black' : 'border-[var(--border2)] text-[var(--muted)] hover:border-[var(--gold2)]'}`}>Normal</button>
              </div>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`cursor-pointer rounded border px-2 py-0.5 text-[10px] transition ${isH3 ? 'border-transparent bg-[var(--gold2)] text-black' : 'border-[var(--border2)] text-[var(--muted)] hover:border-[var(--gold2)]'}`}>H3</button>
              <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`cursor-pointer rounded border px-2 py-0.5 text-[10px] italic transition ${isBlockquote ? 'border-transparent bg-[var(--gold2)] text-black' : 'border-[var(--border2)] text-[var(--muted)] hover:border-[var(--gold2)]'}`}>Citação</button>
              <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="cursor-pointer rounded border border-[var(--border2)] px-2 py-0.5 text-[10px] text-[var(--muted)] transition hover:border-[var(--gold2)]" title="Linha separadora">—</button>
            </div>
          </div>
        </Group>

        {/* ── Equações ── */}
        <Group label="Equações" minWidth={58}>
          <BigBtn icon="π" label="Equações" onClick={() => setShowMath(true)} title="Inserir equação LaTeX (Ctrl+E)" />
        </Group>

        {/* ── Símbolos (sem separador final) ── */}
        <div className="flex flex-col items-center px-2" style={{ minWidth: 50 }}>
          <div className="flex flex-1 items-center">
            <BigBtn icon="Ω" label="Símbolos" title="Inserir símbolo" />
          </div>
          <p className="mt-auto pt-1 font-mono text-[9px] text-[var(--dim)]">Símbolos</p>
        </div>
      </div>
    </>
  );
}
