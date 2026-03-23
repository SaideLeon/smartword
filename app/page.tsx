'use client';

import { useState, useCallback } from 'react';
import { useDocumentEditor } from '@/hooks/useDocumentEditor';
import { useIsMobile } from '@/hooks/use-mobile';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { ExportButton } from '@/components/ExportButton';
import { AiChat } from '@/components/AiChat';

export default function Home() {
  const { markdown, setMarkdown, filename, setFilename, loading, exportDocx } = useDocumentEditor();
  const [chatOpen, setChatOpen] = useState(false);
  const isMobile = useIsMobile();

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
        minHeight: '100vh',
        height: '100dvh',
        overflow: 'hidden',
        background: '#0f0e0d',
        color: '#e8e2d9',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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

      <header
        style={{
          position: 'relative',
          zIndex: 1,
          borderBottom: '1px solid #2a2520',
          padding: isMobile ? '0.75rem 1rem' : '0 2.5rem',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '0.75rem' : '1rem',
          minHeight: isMobile ? 'auto' : '64px',
          flexShrink: 0,
          backdropFilter: 'blur(8px)',
          background: 'rgba(15, 14, 13, 0.85)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
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
              flexShrink: 0,
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
              lineHeight: 1.35,
            }}
          >
            docx
            <span style={{ color: '#5a5248', fontStyle: 'normal' }}> · </span>
            <span style={{ color: '#8a7d6e', fontStyle: 'normal', fontSize: '13px' }}>
              Markdown para Word com Equações Nativas
            </span>
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '0.65rem' : '1rem',
            width: isMobile ? '100%' : 'auto',
            justifyContent: isMobile ? 'space-between' : 'flex-end',
            flexWrap: 'wrap',
          }}
        >
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
          >
            <span>✦</span>
            <span>{chatOpen ? 'Fechar IA' : 'IA'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
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
                flexShrink: 0,
              }}
            />
          </div>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: chatOpen && isMobile ? 'hidden' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: isMobile ? '1rem 0.9rem 0.75rem' : '2.5rem 2rem 1rem',
            gap: '1.25rem',
            minWidth: 0,
            minHeight: 0,
            transition: 'all 0.3s ease',
          }}
        >
          <div style={{ maxWidth: '960px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h1
                style={{
                  fontSize: isMobile ? '1.35rem' : 'clamp(1.4rem, 3vw, 2.2rem)',
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
                  fontSize: isMobile ? '12px' : '13px',
                  fontFamily: 'monospace',
                  letterSpacing: '0.04em',
                  lineHeight: 1.5,
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

            <div
              style={{
                display: 'flex',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'space-between',
                flexDirection: isMobile ? 'column' : 'row',
                gap: '0.75rem',
                padding: isMobile ? '0.85rem' : '0.9rem 1rem',
                border: '1px solid #2a2520',
                borderRadius: '10px',
                background: 'rgba(26, 23, 20, 0.72)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#c9a96e',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  PWA pronta para instalar
                </span>
                <span
                  style={{
                    color: '#8a7d6e',
                    fontSize: isMobile ? '12px' : '13px',
                    lineHeight: 1.5,
                  }}
                >
                  Adicione esta app ao ecrã inicial para abrir em modo standalone e manter os ficheiros essenciais em cache offline.
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    border: '1px solid #3a3229',
                    borderRadius: '999px',
                    padding: '0.35rem 0.7rem',
                    fontSize: '11px',
                    color: '#e8e2d9',
                    fontFamily: 'monospace',
                    letterSpacing: '0.06em',
                  }}
                >
                  Android/Chrome: Instalar
                </span>
                <span
                  style={{
                    border: '1px solid #3a3229',
                    borderRadius: '999px',
                    padding: '0.35rem 0.7rem',
                    fontSize: '11px',
                    color: '#e8e2d9',
                    fontFamily: 'monospace',
                    letterSpacing: '0.06em',
                  }}
                >
                  iPhone/iPad: Partilhar → Ecrã inicial
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: isMobile ? 'stretch' : 'center',
                flexDirection: isMobile ? 'column' : 'row',
                gap: '0.75rem',
              }}
            >
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
              <div style={{ position: 'relative', flex: isMobile ? '1 1 auto' : '0 0 auto', width: isMobile ? '100%' : 'auto' }}>
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
                    width: isMobile ? '100%' : '220px',
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

            <MarkdownEditor value={markdown} onChange={setMarkdown} isMobile={isMobile} />
          </div>
        </div>

        {chatOpen && (
          <div
            style={{
              position: isMobile ? 'absolute' : 'relative',
              inset: isMobile ? 0 : 'auto',
              width: isMobile ? '100%' : '380px',
              height: isMobile ? '100%' : 'auto',
              maxHeight: 'none',
              minHeight: isMobile ? 0 : '0',
              flexShrink: 0,
              borderLeft: isMobile ? 'none' : '1px solid #2a2520',
              display: 'flex',
              flexDirection: 'column',
              animation: isMobile ? 'slideUp 0.25s ease' : 'slideIn 0.25s ease',
              minWidth: 0,
              zIndex: isMobile ? 3 : 'auto',
              background: '#0d0c0b',
              boxShadow: isMobile ? '0 -16px 40px rgba(0, 0, 0, 0.45)' : 'none',
            }}
          >
            <AiChat
              onInsert={handleInsert}
              onReplace={handleReplace}
              onClose={() => setChatOpen(false)}
              isMobile={isMobile}
            />
          </div>
        )}
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          flexShrink: 0,
          borderTop: '1px solid #2a2520',
          background: 'rgba(15, 14, 13, 0.95)',
          backdropFilter: 'blur(12px)',
          padding: isMobile ? '0.75rem 0.9rem calc(0.9rem + env(safe-area-inset-bottom, 0px))' : '0.75rem 2rem',
          display: 'flex',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
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
        <ExportButton onClick={exportDocx} loading={loading} filename={filename} fullWidth={isMobile} />
      </div>

      {!isMobile && (
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
      )}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
