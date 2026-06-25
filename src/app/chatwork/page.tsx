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

function getLineClass(line: string): string {
  if (line.startsWith('# ')) return 'text-2xl font-bold text-white';
  if (line.startsWith('## ')) return 'mt-5 text-lg font-semibold text-white';
  if (line.startsWith('### ')) return 'mt-4 text-base font-semibold text-white';
  if (line.startsWith('- ')) return 'ml-5 list-item text-[var(--text-secondary)]';
  if (line.startsWith('> ')) return 'border-l-2 border-[var(--accent-teal)] pl-3 italic text-[var(--text-secondary)]';
  return 'text-[var(--text-primary)]';
}

export default function ChatworkPage() {
  const [documentMarkdown, setDocumentMarkdown] = useState(INITIAL_DOCUMENT);
  const [selectedText, setSelectedText] = useState('');
  const [command, setCommand] = useState('');
  const [messages, setMessages] = useState<ChatworkMessage[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou o agente Chatwork. Selecciona uma área do documento ou dá um comando por fases para eu editar contigo.',
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const previewLines = useMemo(() => markdownToPreview(documentMarkdown), [documentMarkdown]);

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
      setMessages(current => [...current, { role: 'assistant', content: data.reply }]);
      setSelectedText('');
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
      setMessages(current => [...current, { role: 'assistant', content: 'Importei o DOCX para o workspace. Agora podes pedir alterações por comando.' }]);
    } catch (err: any) {
      setError(err.message || 'Erro ao importar o DOCX.');
    } finally {
      setIsImporting(false);
    }
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
    <main className="min-h-screen bg-[#0f0f10] text-[var(--text-primary)]">
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[#151516] px-5 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent-teal)]">Nova interface experimental</p>
            <h1 className="text-lg font-semibold text-white">Chatwork Workspace</h1>
          </div>
          <div className="hidden rounded-full border border-[var(--border)] px-3 py-1 font-mono text-[11px] text-[var(--text-secondary)] md:block">
            Documento + agente em tempo real
          </div>
        </header>

        <section className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[360px_minmax(0,1fr)_420px]">
          <aside className="flex min-h-0 flex-col border-r border-[var(--border)] bg-[#151516]">
            <div className="border-b border-[var(--border)] p-4">
              <h2 className="text-sm font-semibold text-white">Agente IA</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                Conversa por fases: pede para melhorar uma secção, trocar palavras, sublinhar ideias, expandir objectivos ou reformular parágrafos.
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-2xl px-3 py-2 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'ml-8 bg-[var(--accent-teal)] text-black'
                      : 'mr-8 border border-[var(--border)] bg-[#1d1d1f] text-[var(--text-primary)]'
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {isSending && (
                <div className="mr-8 rounded-2xl border border-[var(--border)] bg-[#1d1d1f] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  O agente está a analisar o documento…
                </div>
              )}
            </div>

            <form onSubmit={submitCommand} className="border-t border-[var(--border)] p-4">
              {selectedText && (
                <div className="mb-3 rounded-xl border border-[var(--accent-teal)]/40 bg-[var(--accent-teal)]/10 p-3 text-xs text-[var(--text-secondary)]">
                  <strong className="text-[var(--accent-teal)]">Selecção activa:</strong> {selectedText.slice(0, 160)}{selectedText.length > 160 ? '…' : ''}
                </div>
              )}
              {error && <p className="mb-2 text-xs text-red-300">{error}</p>}
              <textarea
                value={command}
                onChange={event => setCommand(event.target.value)}
                placeholder="Ex.: melhora a introdução, troca esta palavra, sublinha a ideia principal…"
                className="h-24 w-full resize-none rounded-2xl border border-[var(--border)] bg-[#101011] p-3 text-sm outline-none focus:border-[var(--accent-teal)]"
              />
              <div className="mt-3 flex gap-2">
                <button type="submit" disabled={isSending} className="flex-1 rounded-xl bg-[var(--accent-teal)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                  Enviar comando
                </button>
                <button type="button" onClick={startVoiceCommand} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-white">
                  Voz
                </button>
              </div>
            </form>
          </aside>

          <section className="flex min-h-0 flex-col bg-[#101011]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Editor do documento</h2>
                <p className="text-xs text-[var(--text-secondary)]">Selecciona um trecho e clica em “Usar selecção”.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-white hover:border-[var(--accent-teal)]">
                  {isImporting ? 'A importar…' : 'Importar DOCX'}
                  <input
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={event => importDocx(event.target.files?.[0])}
                    disabled={isImporting}
                  />
                </label>
                <button onClick={captureSelection} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-white hover:border-[var(--accent-teal)]">
                  Usar selecção
                </button>
              </div>
            </div>
            <textarea
              ref={textAreaRef}
              value={documentMarkdown}
              onChange={event => setDocumentMarkdown(event.target.value)}
              onSelect={captureSelection}
              className="min-h-0 flex-1 resize-none bg-[#101011] p-6 font-mono text-sm leading-7 text-[var(--text-primary)] outline-none"
              spellCheck={false}
            />
          </section>

          <aside className="flex min-h-0 flex-col border-l border-[var(--border)] bg-[#f7f3ea] text-[#201b15]">
            <div className="border-b border-[#ded6c8] px-4 py-3">
              <h2 className="text-sm font-semibold">Pré-visualização</h2>
              <p className="text-xs text-[#746858]">Visualização em tempo real do trabalho enquanto conversas com o agente.</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <article className="mx-auto min-h-full max-w-[720px] rounded-sm bg-white px-8 py-10 shadow-2xl shadow-black/10">
                {previewLines.map((line, index) => {
                  const clean = line.replace(/^#{1,3}\s*/, '').replace(/^-\s*/, '• ').replace(/^>\s*/, '');
                  return line.trim() ? (
                    <p key={index} className={`${getLineClass(line)} mb-3 leading-7`}>
                      {clean}
                    </p>
                  ) : <div key={index} className="h-3" />;
                })}
              </article>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
