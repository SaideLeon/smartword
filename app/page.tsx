'use client';

import { useState, useCallback } from 'react';
import { useDocumentEditor } from '@/hooks/useDocumentEditor';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { ExportButton } from '@/components/ExportButton';
import { AiChat } from '@/components/AiChat';

export default function Home() {
  const { markdown, setMarkdown, filename, setFilename, loading, exportDocx } = useDocumentEditor();
  const [chatOpen, setChatOpen] = useState(false);

  const handleInsert = useCallback(
    (text: string) => {
      setMarkdown(prev => (prev ? `${prev}\n\n${text}` : text));
    },
    [setMarkdown],
  );

  const handleReplace = useCallback(
    (text: string) => {
      setMarkdown(text);
    },
    [setMarkdown],
  );

  return (
    <main
      style={{
        height: '100vh',
        overflow: 'hidden',
        background: '#0f0e0d',
        color: '#e8e2d9',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Grain overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
          backgroundSize: '180px',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.5,
        }}
      />

      {/* Header */}
      <header
        style={{
          position: 'relative',
          zIndex: 1,
          borderBottom: '1px solid #2a2520',
          padding: '0 2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          flexShrink: 0,
          backdropFilter: 'blur(8px)',
          background: 'rgba(15, 14, 13, 0.85)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '4px',
              background: 'linear-gradient(135deg, #c9a96e 0%, #8b6914 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              color: '#0f0e0d',
              fontFamily: 'monospace',
            }}
          >
            ∂
          </span>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 400,
              letterSpacing: '0.06em',
              color: '#c9a96e',
              fontFamily: "'Georgia', serif",
              fontStyle: 'italic',
            }}
          >
            docx
            <span style={{ color: '#5a5248', fontStyle: 'normal' }}> · </span>
            <span style={{ color: '#8a7d6e', fontStyle: 'normal', fontSize: '13px' }}>
              Markdown para Word com Equações Nativas
            </span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Botão toggle do chat */}
          <button
            onClick={() => setChatOpen(o => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: chatOpen ? '#c9a96e22' : '#1a1714',
              border: `1px solid ${chatOpen ? '#c9a96e55' : '#2a2520'}`,
              borderRadius: '5px',
              color: chatOpen ? '#c9a96e' : '#8a7d6e',
              fontFamily: 'monospace',
              fontSize: '12px',
              padding: '5px 12px',
              cursor: 'pointer',
              letterSpacing: '0.05em',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => {
              if (!chatOpen) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#c9a96e44';
                (e.currentTarget as HTMLButtonElement).style.color = '#c9a96e';
              }
            }}
            onMouseOut={e => {
              if (!chatOpen) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2520';
                (e.currentTarget as HTMLButtonElement).style.color = '#8a7d6e';
              }
            }}
          >
            <span>✦</span>
            <span>IA</span>
          </button>

          <span
            style={{
              fontSize: '11px',
              color: '#4a4440',
              fontFamily: 'monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            LaTeX → OMML
          </span>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4a7c59',
              boxShadow: '0 0 6px #4a7c59',
              display: 'inline-block',
            }}
          />
        </div>
      </header>

      {/* Corpo: editor + chat lado a lado */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* Coluna do editor */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: '2.5rem 2rem 1rem',
            gap: '1.75rem',
            minWidth: 0,
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ maxWidth: '960px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Title */}
            <div>
              <h1
                style={{
                  fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
                  fontWeight: 400,
                  fontStyle: 'italic',
                  color: '#e8e2d9',
                  margin: 0,
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                }}
              >
                Escreva em Markdown,
                <br />
                <span style={{ color: '#c9a96e' }}>exporte com equações Word nativas.</span>
              </h1>
              <p
                style={{
                  marginTop: '0.6rem',
                  color: '#5a5248',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  letterSpacing: '0.04em',
                }}
              >
                Suporta{' '}
                <code style={{ color: '#c9a96e', background: '#1e1b18', padding: '1px 5px', borderRadius: '3px' }}>
                  $...$
                </code>{' '}
                e{' '}
                <code style={{ color: '#c9a96e', background: '#1e1b18', padding: '1px 5px', borderRadius: '3px' }}>
                  $$...$$
                </code>{' '}
                convertidos para OMML — equações editáveis directamente no Word.
              </p>
            </div>

            {/* Filename */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#5a5248',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                Nome do ficheiro
              </label>
              <div style={{ position: 'relative', flex: '0 0 auto' }}>
                <input
                  type="text"
                  value={filename}
                  onChange={e => setFilename(e.target.value)}
                  style={{
                    background: '#1a1714',
                    border: '1px solid #2a2520',
                    borderRadius: '4px',
                    color: '#c9a96e',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    padding: '6px 48px 6px 10px',
                    outline: 'none',
                    width: '220px',
                    letterSpacing: '0.02em',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => ((e.target as HTMLInputElement).style.borderColor = '#c9a96e55')}
                  onBlur={e => ((e.target as HTMLInputElement).style.borderColor = '#2a2520')}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '11px',
                    color: '#4a4440',
                    fontFamily: 'monospace',
                    pointerEvents: 'none',
                  }}
                >
                  .docx
                </span>
              </div>
            </div>

            {/* Editor */}
            <MarkdownEditor value={markdown} onChange={setMarkdown} />
          </div>
        </div>

        {/* Painel de chat IA */}
        {chatOpen && (
          <div
            style={{
              width: '380px',
              flexShrink: 0,
              borderLeft: '1px solid #2a2520',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideIn 0.25s ease',
            }}
          >
            <AiChat
              onInsert={handleInsert}
              onReplace={handleReplace}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Barra fixa de exportação */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          flexShrink: 0,
          borderTop: '1px solid #2a2520',
          background: 'rgba(15, 14, 13, 0.95)',
          backdropFilter: 'blur(12px)',
          padding: '0.75rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: '#3a3530',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}
        >
          {markdown.split('\n').length} linhas · {markdown.length} caracteres
        </div>
        <ExportButton onClick={exportDocx} loading={loading} filename={filename} />
      </div>

      {/* Footer */}
      <footer
        style={{
          position: 'relative',
          zIndex: 1,
          flexShrink: 0,
          borderTop: '1px solid #1e1b18',
          padding: '0.75rem 2.5rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '11px', color: '#3a3530', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
          temml · mathml2omml · docx · Quelimane, Moçambique
        </span>
      </footer>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </main>
  );
}
