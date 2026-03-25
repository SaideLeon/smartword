'use client';

import { useCallback } from 'react';
import { useDocumentEditor } from '@/hooks/useDocumentEditor';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSidePanel, usePanelActions } from '@/hooks/useEditorStore';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { ExportButton } from '@/components/ExportButton';
import { AiChat } from '@/components/AiChat';
import { TccPanel } from '@/components/TccPanel';
import { WorkPanel } from '@/components/WorkPanel';

export default function Home() {
  const { markdown, setMarkdown, filename, setFilename, loading, exportDocx, clearDefaultMarkdown, setFilenameFromTopic } = useDocumentEditor();

  // ── Estado do painel lateral vem agora do store global ───────────────────
  const sidePanel    = useSidePanel();
  const { togglePanel, closePanel } = usePanelActions();

  const isMobile = useIsMobile();

  const handleInsert = useCallback(
    (text: string) => {
      setMarkdown(prev => (prev ? `${prev}\n\n${text}` : text));
    },
    [setMarkdown],
  );

  const handleReplace = useCallback(
    (text: string) => { setMarkdown(text); },
    [setMarkdown],
  );

  // togglePanel agora também limpa o markdown de exemplo, tal como antes
  const handleTogglePanel = useCallback(
    (panel: Parameters<typeof togglePanel>[0]) => {
      clearDefaultMarkdown();
      togglePanel(panel);
    },
    [clearDefaultMarkdown, togglePanel],
  );

  return (
    <main
      style={{
        minHeight: '100vh', height: '100dvh', overflow: 'hidden',
        background: '#0f0e0d', color: '#e8e2d9',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* ── Grain overlay ───────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'repeat', backgroundSize: '180px',
        pointerEvents: 'none', zIndex: 0, opacity: 0.5,
      }} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'relative', zIndex: 1,
        borderBottom: '1px solid #2a2520',
        padding: isMobile ? '0.75rem 1rem' : '0 2.5rem',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '0.75rem' : '1rem',
        minHeight: isMobile ? 'auto' : '64px',
        flexShrink: 0, backdropFilter: 'blur(8px)',
        background: 'rgba(15, 14, 13, 0.85)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <span style={{
            width: 28, height: 28, borderRadius: '4px',
            background: 'linear-gradient(135deg, #c9a96e 0%, #8b6914 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, color: '#0f0e0d',
            fontFamily: 'monospace', flexShrink: 0,
          }}>∂</span>
          <span style={{
            fontSize: '15px', fontWeight: 400, letterSpacing: '0.06em',
            color: '#c9a96e', fontFamily: "'Georgia', serif", fontStyle: 'italic', lineHeight: 1.35,
          }}>
            Muneri
            <span style={{ color: '#5a5248', fontStyle: 'normal' }}> · </span>
            <span style={{ color: '#8a7d6e', fontStyle: 'normal', fontSize: '13px' }}>
              Markdown para Word com Equações Nativas
            </span>
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center',
          gap: isMobile ? '0.65rem' : '0.75rem',
          width: isMobile ? '100%' : 'auto',
          justifyContent: isMobile ? 'space-between' : 'flex-end',
          flexWrap: 'wrap',
        }}>
          {/* Botão Trabalhos */}
          <button
            className="press-feedback"
            onClick={() => handleTogglePanel('work')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: sidePanel === 'work' ? '#0a140a' : '#1a1714',
              border: `1px solid ${sidePanel === 'work' ? '#5a9e8f55' : '#2a2520'}`,
              borderRadius: '5px',
              color: sidePanel === 'work' ? '#5a9e8f' : '#8a7d6e',
              fontFamily: 'monospace', fontSize: '12px',
              padding: '5px 12px', cursor: 'pointer',
              letterSpacing: '0.05em', transition: 'all 0.2s',
            }}
          >
            <span>📚</span>
            <span>{sidePanel === 'work' ? 'Fechar Trabalhos' : 'Trabalhos'}</span>
          </button>

          {/* Botão TCC */}
          <button
            className="press-feedback"
            onClick={() => handleTogglePanel('tcc')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: sidePanel === 'tcc' ? '#0b1a0b' : '#1a1714',
              border: `1px solid ${sidePanel === 'tcc' ? '#6a9e5f55' : '#2a2520'}`,
              borderRadius: '5px',
              color: sidePanel === 'tcc' ? '#6a9e5f' : '#8a7d6e',
              fontFamily: 'monospace', fontSize: '12px',
              padding: '5px 12px', cursor: 'pointer',
              letterSpacing: '0.05em', transition: 'all 0.2s',
            }}
          >
            <span>📝</span>
            <span>{sidePanel === 'tcc' ? 'Fechar TCC' : 'TCC'}</span>
          </button>

          {/* Botão IA Chat */}
          <button
            className="press-feedback"
            onClick={() => handleTogglePanel('chat')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: sidePanel === 'chat' ? '#c9a96e22' : '#1a1714',
              border: `1px solid ${sidePanel === 'chat' ? '#c9a96e55' : '#2a2520'}`,
              borderRadius: '5px',
              color: sidePanel === 'chat' ? '#c9a96e' : '#8a7d6e',
              fontFamily: 'monospace', fontSize: '12px',
              padding: '5px 12px', cursor: 'pointer',
              letterSpacing: '0.05em', transition: 'all 0.2s',
            }}
          >
            <span>✦</span>
            <span>{sidePanel === 'chat' ? 'Fechar IA' : 'IA'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <span style={{
              fontSize: '11px', color: '#4a4440', fontFamily: 'monospace',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>LaTeX → OMML</span>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#4a7c59', boxShadow: '0 0 6px #4a7c59',
              display: 'inline-block', flexShrink: 0,
            }} />
          </div>
        </div>
      </header>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        overflow: 'hidden', position: 'relative', zIndex: 1, minHeight: 0,
      }}>
        {/* ── Editor ────────────────────────────────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: sidePanel !== 'none' && isMobile ? 'hidden' : 'auto',
          display: 'flex', flexDirection: 'column',
          padding: isMobile ? '1rem 0.9rem 0.75rem' : '2.5rem 2rem 1rem',
          gap: '1.25rem', minWidth: 0, minHeight: 0, transition: 'all 0.3s ease',
        }}>
          <div style={{ maxWidth: '960px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Filename input */}
            <div style={{
              display: 'flex', alignItems: isMobile ? 'stretch' : 'center',
              flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem',
            }}>
              <label style={{ fontSize: '11px', fontFamily: 'monospace', color: '#5a5248', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Nome do ficheiro
              </label>
              <div style={{ position: 'relative', flex: isMobile ? '1 1 auto' : '0 0 auto', width: isMobile ? '100%' : 'auto' }}>
                <input
                  type="text" value={filename} onChange={e => setFilename(e.target.value)}
                  style={{
                    background: '#1a1714', border: '1px solid #2a2520', borderRadius: '4px',
                    color: '#c9a96e', fontFamily: 'monospace', fontSize: '13px',
                    padding: '6px 48px 6px 10px', outline: 'none',
                    width: isMobile ? '100%' : '220px',
                    letterSpacing: '0.02em', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => ((e.target as HTMLInputElement).style.borderColor = '#c9a96e55')}
                  onBlur={e  => ((e.target as HTMLInputElement).style.borderColor = '#2a2520')}
                />
                <span style={{
                  position: 'absolute', right: '10px', top: '50%',
                  transform: 'translateY(-50%)', fontSize: '11px',
                  color: '#4a4440', fontFamily: 'monospace', pointerEvents: 'none',
                }}>.docx</span>
              </div>
            </div>

            <MarkdownEditor value={markdown} onChange={setMarkdown} isMobile={isMobile} />
          </div>
        </div>

        {/* ── Side Panel ──────────────────────────────────────────────────────── */}
        {sidePanel !== 'none' && (
          <div style={{
            position: isMobile ? 'absolute' : 'relative',
            inset: isMobile ? 0 : 'auto',
            width: isMobile ? '100%' : '380px',
            height: isMobile ? '100%' : 'auto',
            maxHeight: 'none', minHeight: isMobile ? 0 : '0',
            flexShrink: 0,
            borderLeft: isMobile ? 'none' : '1px solid #2a2520',
            display: 'flex', flexDirection: 'column',
            animation: isMobile ? 'slideUp 0.25s ease' : 'slideIn 0.25s ease',
            minWidth: 0, zIndex: isMobile ? 3 : 'auto',
            background: sidePanel === 'tcc' ? '#0b0d0b' : sidePanel === 'work' ? '#0a0d0a' : '#0d0c0b',
            boxShadow: isMobile ? '0 -16px 40px rgba(0,0,0,0.45)' : 'none',
          }}>
            {sidePanel === 'chat' && (
              <AiChat onInsert={handleInsert} onReplace={handleReplace} onClose={closePanel} isMobile={isMobile} />
            )}
            {sidePanel === 'tcc' && (
              <TccPanel onInsert={handleInsert} onTopicChange={setFilenameFromTopic} onClose={closePanel} isMobile={isMobile} />
            )}
            {sidePanel === 'work' && (
              <WorkPanel onInsert={handleInsert} onTopicChange={setFilenameFromTopic} onClose={closePanel} isMobile={isMobile} />
            )}
          </div>
        )}
      </div>

      {/* ── Footer / Export bar ─────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 2, flexShrink: 0,
        borderTop: '1px solid #2a2520',
        background: 'rgba(15, 14, 13, 0.95)', backdropFilter: 'blur(12px)',
        padding: isMobile ? '0.75rem 0.9rem calc(0.9rem + env(safe-area-inset-bottom, 0px))' : '0.75rem 2rem',
        display: 'flex', alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem',
      }}>
        <div style={{ fontSize: '11px', color: '#3a3530', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          {markdown.split('\n').length} linhas · {markdown.length} caracteres
        </div>
        <ExportButton onClick={exportDocx} loading={loading} filename={filename} fullWidth={isMobile} />
      </div>

      {!isMobile && (
        <footer style={{
          position: 'relative', zIndex: 1, flexShrink: 0,
          borderTop: '1px solid #1e1b18',
          padding: '0.75rem 2.5rem',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
        }}>
          <span style={{ fontSize: '11px', color: '#3a3530', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
            temml · mathml2omml · Muneri · Quelimane, Moçambique
          </span>
        </footer>
      )}

      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </main>
  );
}
