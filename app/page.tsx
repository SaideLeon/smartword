'use client';

import { useDocumentEditor } from '@/hooks/useDocumentEditor';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { ExportButton } from '@/components/ExportButton';

export default function Home() {
  const { markdown, setMarkdown, filename, setFilename, loading, exportDocx } = useDocumentEditor();

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '960px',
          width: '100%',
          margin: '0 auto',
          padding: '2.5rem 2rem',
          gap: '1.75rem',
        }}
      >
        {/* Title row */}
        <div>
          <h1
            style={{
              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
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

        {/* Filename field */}
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

        {/* Footer bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
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
      </div>

      {/* Footer */}
      <footer
        style={{
          position: 'relative',
          zIndex: 1,
          borderTop: '1px solid #1e1b18',
          padding: '1rem 2.5rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '11px', color: '#3a3530', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
          temml · mathml2omml · docx · Quelimane, Moçambique
        </span>
      </footer>
    </main>
  );
}
