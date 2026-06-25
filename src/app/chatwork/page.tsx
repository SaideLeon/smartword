'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';

type ChatworkMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AgentResponse = {
  reply: string;
  documentMarkdown: string;
  edits: Array<{ summary: string }>;
};

type WorkspaceMode = 'preview' | 'source';

type PhaseStatus = 'done' | 'active' | 'waiting';

type AgentPhase = {
  title: string;
  description: string;
  status: PhaseStatus;
};

const INITIAL_DOCUMENT = `# Trabalho académico

## I. Introdução
Escreve aqui a introdução do trabalho. Podes seleccionar qualquer parte do documento e pedir ao agente para melhorar, expandir, resumir ou formatar.

## II. Objectivos
- Definir o objectivo geral.
- Listar três objectivos específicos.

## III. Desenvolvimento
Começa por desenvolver o tema principal em linguagem académica.

## IV. Conclusão
Apresenta a síntese final do trabalho.`;

function markdownToPreview(markdown: string): string[] {
  return markdown.split('\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildExportHtml(markdown: string): string {
  return markdown
    .split('\n')
    .map(line => {
      const clean = escapeHtml(stripMarkdownPrefix(line));
      if (!line.trim()) return '<br />';
      if (line.startsWith('# ')) return `<h1>${clean}</h1>`;
      if (line.startsWith('## ')) return `<h2>${clean}</h2>`;
      if (line.startsWith('### ')) return `<h3>${clean}</h3>`;
      if (line.startsWith('- ')) return `<li>${clean}</li>`;
      return `<p>${clean}</p>`;
    })
    .join('\n');
}

function downloadDocument(markdown: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Georgia,serif;line-height:1.7;margin:48px}h1{text-align:center;text-transform:uppercase}h2{text-transform:uppercase;margin-top:32px}</style></head><body>${buildExportHtml(markdown)}</body></html>`;
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'chatwork-documento.doc';
  anchor.click();
  URL.revokeObjectURL(url);
}

function getLineClass(line: string): string {
  if (line.startsWith('# ')) return 'mb-10 text-center text-[15px] font-bold uppercase tracking-wide text-black';
  if (line.startsWith('## ')) return 'mb-4 mt-8 text-[13px] font-bold uppercase text-black';
  if (line.startsWith('### ')) return 'mb-3 mt-5 text-[12px] font-bold text-black';
  if (line.startsWith('- ')) return 'ml-8 list-item text-[12px] leading-6 text-black';
  if (line.startsWith('> ')) return 'border-l-2 border-neutral-500 pl-3 italic text-neutral-700';
  return 'mb-3 text-[12px] leading-6 text-black';
}

function stripMarkdownPrefix(line: string): string {
  return line.replace(/^#{1,3}\s*/, '').replace(/^-\s*/, '').replace(/^>\s*/, '');
}

export default function ChatworkPage() {
  const [documentMarkdown, setDocumentMarkdown] = useState(INITIAL_DOCUMENT);
  const [selectedText, setSelectedText] = useState('');
  const [command, setCommand] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('preview');
  const [messages, setMessages] = useState<ChatworkMessage[]>([
    {
      role: 'assistant',
      content: 'Olá! Importa um DOCX, selecciona uma área do documento ou dá comandos por fases. Eu actualizo o trabalho e mantemos a pré-visualização aberta.',
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [documentFileName, setDocumentFileName] = useState('Documento de exemplo');
  const [lastEditSummaries, setLastEditSummaries] = useState<string[]>([]);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const previewLines = useMemo(() => markdownToPreview(documentMarkdown), [documentMarkdown]);
  const phases: AgentPhase[] = useMemo(() => [
    { title: '1. Ler contexto', description: selectedText ? 'Selecção pronta para edição localizada.' : 'Documento completo disponível para o agente.', status: 'done' },
    { title: '2. Comando por fase', description: command ? 'Pedido preparado no chat.' : 'Escreve ou dita a próxima instrução.', status: command ? 'done' : 'active' },
    { title: '3. Aplicar no documento', description: isSending ? 'Agente a editar a área indicada.' : 'Aguardando envio para actualizar a pré-visualização.', status: isSending ? 'active' : 'waiting' },
  ], [command, isSending, selectedText]);

  function captureSelection() {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value.slice(start, end).trim();
    setSelectedText(text);
  }

  async function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = command.trim();
    if (!trimmed || isSending) return;

    const nextMessages: ChatworkMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setCommand('');
    setError('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chatwork/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentMarkdown,
          selectedText,
          command: trimmed,
          messages: nextMessages.slice(-8),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao comunicar com o agente.');
      }

      const data = await response.json() as AgentResponse;
      setDocumentMarkdown(data.documentMarkdown);
      setLastEditSummaries(data.edits.map(edit => edit.summary).filter(Boolean));
      setMessages(current => [...current, { role: 'assistant', content: data.reply }]);
      setSelectedText('');
      setWorkspaceMode('preview');
    } catch (err: any) {
      setError(err.message || 'Erro inesperado no Chatwork.');
      setMessages(current => [...current, { role: 'assistant', content: 'Não consegui aplicar a alteração agora. Tenta novamente ou reformula o comando.' }]);
    } finally {
      setIsSending(false);
    }
  }

  async function importDocx(file: File | undefined) {
    if (!file || isImporting) return;

    const formData = new FormData();
    formData.append('file', file);
    setIsImporting(true);
    setError('');

    try {
      const response = await fetch('/api/chatwork/docx/preview', { method: 'POST', body: formData });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Falha ao importar o DOCX.');
      }

      const data = await response.json() as { markdown: string; warnings?: string[] };
      setDocumentMarkdown(data.markdown);
      setDocumentFileName(file.name);
      setWorkspaceMode('preview');
      setMessages(current => [...current, { role: 'assistant', content: 'Importei o DOCX para a área de trabalho. Agora podes pedir alterações por comando.' }]);
    } catch (err: any) {
      setError(err.message || 'Erro ao importar o DOCX.');
    } finally {
      setIsImporting(false);
    }
  }

  function selectPreviewParagraph(text: string) {
    const clean = text.trim();
    if (!clean) return;
    setSelectedText(clean);
    setCommand(current => current || `Altera apenas este trecho: "${clean.slice(0, 80)}${clean.length > 80 ? '…' : ''}"`);
  }

  function startVoiceCommand() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('O reconhecimento de voz não está disponível neste navegador.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-PT';
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) setCommand(transcript);
    };
    recognition.onerror = () => setError('Não foi possível captar o comando de voz.');
    recognition.start();
  }

  return (
    <main className="h-screen overflow-hidden bg-[#1b1b1a] text-[#f4f0ea]">
      <div className="grid h-full grid-cols-[48px_minmax(360px,49vw)_minmax(420px,1fr)]">
        <nav className="flex flex-col items-center border-r border-white/10 bg-[#191918] py-3 text-neutral-300">
          <div className="mb-5 flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316] text-sm font-bold text-white">C</div>
          {['+', '◌', '▱', '⌘', '▣'].map(item => (
            <button key={item} className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-white/10" type="button">
              {item}
            </button>
          ))}
          <div className="mt-auto flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-900">SO</div>
        </nav>

        <section className="relative flex min-w-0 flex-col border-r border-white/10 bg-[#1b1b1a]">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-5">
            <button className="flex items-center gap-2 text-sm font-semibold text-white" type="button">
              Chatwork — edição de Word <span className="text-neutral-500">⌄</span>
            </button>
            <label className="flex cursor-pointer items-center gap-2 rounded-full bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#fb8a3c]">
              Subir Word
              <input
                type="file"
                accept=".docx"
                className="hidden"
                onChange={event => importDocx(event.target.files?.[0])}
                disabled={isImporting}
              />
            </label>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-44 pt-5 lg:px-8">
            <div className="mx-auto mb-4 max-w-[760px] rounded-2xl border border-dashed border-[#f97316]/40 bg-[#f97316]/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Suba um documento Word para começar a edição com o agente.</p>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">Depois do upload, o texto aparece no painel da direita e podes pedir: “altera a introdução”, “corrige valores”, “sublinha esta frase” ou “formata as tabelas”.</p>
                </div>
                <label className="shrink-0 cursor-pointer rounded-xl bg-white px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-neutral-200">
                  {isImporting ? 'A importar…' : 'Escolher .docx'}
                  <input
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={event => importDocx(event.target.files?.[0])}
                    disabled={isImporting}
                  />
                </label>
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-neutral-300">
                Documento activo: <strong className="text-[#ffb18b]">{documentFileName}</strong>
              </div>
            </div>

            <div className="mx-auto mb-6 grid max-w-[760px] gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-3">
              {phases.map(phase => (
                <div key={phase.title} className="rounded-xl bg-black/20 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
                    <span className={`h-2.5 w-2.5 rounded-full ${phase.status === 'done' ? 'bg-emerald-400' : phase.status === 'active' ? 'animate-pulse bg-[#f97316]' : 'bg-neutral-600'}`} />
                    {phase.title}
                  </div>
                  <p className="text-xs leading-5 text-neutral-400">{phase.description}</p>
                </div>
              ))}
            </div>

            <div className="mx-auto max-w-[760px] space-y-7">
              {messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={message.role === 'user' ? 'flex justify-end' : 'block'}>
                  <div
                    className={message.role === 'user'
                      ? 'max-w-[78%] rounded-2xl bg-[#111] px-4 py-3 text-[15px] leading-6 text-white shadow-lg'
                      : 'max-w-[88%] text-[15px] leading-7 text-[#e9e2da]'}
                  >
                    {message.role === 'assistant' && index > 0 && (
                      <p className="mb-2 text-xs text-neutral-500">Executou comandos ›</p>
                    )}
                    {message.content}
                  </div>
                </article>
              ))}

              {isSending && (
                <div className="flex items-center gap-3 text-sm text-neutral-400">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#f97316] border-t-transparent" />
                  Trabalhando no documento…
                </div>
              )}
            </div>
          </div>

          <form onSubmit={submitCommand} className="absolute inset-x-4 bottom-4 mx-auto max-w-[760px] rounded-[22px] border border-white/10 bg-[#2a2a28] p-3 shadow-2xl shadow-black/40">
            {selectedText && (
              <div className="mb-2 rounded-xl border border-[#f97316]/40 bg-[#f97316]/10 px-3 py-2 text-xs text-neutral-300">
                <strong className="text-[#ff9b6a]">Selecção activa:</strong> {selectedText.slice(0, 150)}{selectedText.length > 150 ? '…' : ''}
              </div>
            )}
            {error && <p className="mb-2 px-1 text-xs text-red-300">{error}</p>}
            <textarea
              value={command}
              onChange={event => setCommand(event.target.value)}
              placeholder="Escreva uma mensagem…"
              className="h-20 w-full resize-none bg-transparent px-2 py-2 text-[15px] text-white outline-none placeholder:text-neutral-500"
            />
            <div className="flex items-center justify-between px-1 pt-1">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-lg text-white hover:bg-white/10">
                +
                <input
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={event => importDocx(event.target.files?.[0])}
                  disabled={isImporting}
                />
                <span className="text-xs text-neutral-400">{isImporting ? 'A importar…' : 'Adicionar Word'}</span>
              </label>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <span>Agente Chatwork</span>
                <button type="button" onClick={startVoiceCommand} className="rounded-lg px-2 py-1 text-lg text-white hover:bg-white/10">♩</button>
                <button type="submit" disabled={isSending} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f97316] text-lg font-bold text-white disabled:opacity-50">↑</button>
              </div>
            </div>
          </form>
        </section>

        <section className="flex min-w-0 flex-col bg-[#e8e9eb] text-neutral-900">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-black/10 bg-[#2a2a28] px-5 text-neutral-200">
            <div className="min-w-0">
              <p className="truncate text-sm">{documentFileName} · {workspaceMode === 'preview' ? 'Preview' : 'Fonte Markdown'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setWorkspaceMode('preview')} className={`rounded-lg px-3 py-1.5 text-xs ${workspaceMode === 'preview' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:bg-white/10'}`} type="button">Preview</button>
              <button onClick={() => setWorkspaceMode('source')} className={`rounded-lg px-3 py-1.5 text-xs ${workspaceMode === 'source' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:bg-white/10'}`} type="button">Fonte</button>
              <button onClick={captureSelection} className="rounded-lg px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/10" type="button">Usar selecção</button>
              <button onClick={() => downloadDocument(documentMarkdown)} className="rounded-lg px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/10" type="button">Baixar</button>
            </div>
          </header>

          {workspaceMode === 'source' ? (
            <textarea
              ref={textAreaRef}
              value={documentMarkdown}
              onChange={event => setDocumentMarkdown(event.target.value)}
              onSelect={captureSelection}
              className="min-h-0 flex-1 resize-none bg-[#111] p-6 font-mono text-sm leading-7 text-neutral-100 outline-none"
              spellCheck={false}
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8">
              <article className="mx-auto min-h-[920px] max-w-[620px] bg-white px-14 py-16 shadow-xl ring-1 ring-black/10">
                {lastEditSummaries.length > 0 && (
                  <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-5 text-emerald-900">
                    <strong>Últimas alterações:</strong> {lastEditSummaries.join(' · ')}
                  </div>
                )}
                <div className="mb-12 flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-400 text-center text-[9px] font-bold uppercase text-red-500">
                    Logo<br />Instituição
                  </div>
                </div>
                {previewLines.map((line, index) => {
                  const clean = stripMarkdownPrefix(line);
                  return line.trim() ? (
                    <p key={index} onClick={() => selectPreviewParagraph(clean)} className={`${getLineClass(line)} cursor-text rounded px-1 hover:bg-orange-50 hover:outline hover:outline-1 hover:outline-orange-200`} title="Clique para seleccionar este trecho para o agente">
                      {clean}
                    </p>
                  ) : <div key={index} className="h-3" />;
                })}
              </article>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
