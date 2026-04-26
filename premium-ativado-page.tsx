'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function PremiumAtivadoContent() {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  const grantsAdmin = searchParams.get('grants_admin') === 'true';

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#0D0C0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Georgia', 'Times New Roman', serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Grain overlay */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.04\'/%3E%3C/svg%3E")',
          pointerEvents: 'none',
          zIndex: 0,
          opacity: 0.6,
        }}
      />

      {/* Radial glow */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background:
            'radial-gradient(circle, rgba(212,165,53,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '480px',
          background: 'linear-gradient(180deg, #1A1710 0%, #141210 100%)',
          border: '1px solid #2A2418',
          borderRadius: '16px',
          overflow: 'hidden',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* Header stripe */}
        <div
          style={{
            height: '3px',
            background: 'linear-gradient(90deg, #8A6010, #D4A535, #8A6010)',
          }}
        />

        {/* Top section */}
        <div
          style={{
            padding: '44px 40px 36px',
            textAlign: 'center',
            borderBottom: '1px solid #2A2418',
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: '72px',
              height: '72px',
              margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #D4A535, #8A6010)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(212,165,53,0.25)',
            }}
          >
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#FBF0C8', fontFamily: 'Georgia, serif' }}>M</span>
          </div>

          {/* Badge */}
          <div
            style={{
              display: 'inline-block',
              padding: '4px 16px',
              border: '1px solid #3A2E10',
              borderRadius: '20px',
              background: 'rgba(212,165,53,0.08)',
              fontFamily: 'Georgia, serif',
              fontSize: '10px',
              letterSpacing: '3px',
              color: '#8A6010',
              marginBottom: '20px',
              textTransform: 'uppercase',
            }}
          >
            Acesso Premium
          </div>

          {/* Check icon */}
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 20px',
              background: 'rgba(0,214,160,0.1)',
              border: '1.5px solid rgba(0,214,160,0.3)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: visible ? 1 : 0,
              transform: visible ? 'scale(1)' : 'scale(0.7)',
              transition: 'opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path
                d="M4 11L9 16L18 6"
                stroke="#00d6a0"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h1
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '26px',
              fontWeight: 'normal',
              color: '#FBF0C8',
              margin: '0 0 10px',
              lineHeight: 1.3,
            }}
          >
            Premium{' '}
            <span style={{ color: '#D4A535', fontStyle: 'italic' }}>activado!</span>
          </h1>

          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '14px',
              color: '#8A6A4A',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            O teu acesso premium foi ativado com sucesso.
            <br />
            Podes agora usar todas as funcionalidades do Muneri.
          </p>
        </div>

        {/* Features list */}
        <div style={{ padding: '32px 40px', borderBottom: '1px solid #2A2418' }}>
          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '10px',
              letterSpacing: '2.5px',
              color: '#5A5040',
              textTransform: 'uppercase',
              marginBottom: '20px',
            }}
          >
            O que tens acesso
          </p>
          {[
            { icon: '📝', label: 'Geração ilimitada de trabalhos escolares' },
            { icon: '🎓', label: 'Modo TCC completo com compressão de contexto' },
            { icon: '✦', label: 'IA Chat especialista em matemática e ciências' },
            { icon: '📄', label: 'Capa e contracapa automáticas personalizadas' },
            { icon: '⬇', label: 'Exportação Word completa (sem truncagem)' },
          ].map((item, i) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: i < 4 ? '14px' : 0,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateX(0)' : 'translateX(-10px)',
                transition: `opacity 0.4s ease ${0.4 + i * 0.08}s, transform 0.4s ease ${0.4 + i * 0.08}s`,
              }}
            >
              <span style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>{item.icon}</span>
              <span
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '13px',
                  color: '#D4C89A',
                  lineHeight: 1.5,
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ padding: '32px 40px', textAlign: 'center' }}>
          <Link
            href="/app"
            style={{
              display: 'inline-block',
              padding: '14px 40px',
              background: 'linear-gradient(135deg, #D4A535, #8A6010)',
              color: '#FBF0C8',
              fontFamily: 'Georgia, serif',
              fontSize: '13px',
              letterSpacing: '2px',
              textDecoration: 'none',
              borderRadius: '8px',
              textTransform: 'uppercase',
              boxShadow: '0 4px 20px rgba(212,165,53,0.2)',
              transition: 'opacity 0.2s',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            Ir para o editor →
          </Link>

          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '11px',
              color: '#5A5040',
              marginTop: '16px',
              marginBottom: 0,
            }}
          >
            Bem-vindo à plataforma Muneri.
          </p>
        </div>

        {/* Footer stripe */}
        <div
          style={{
            padding: '16px 40px 20px',
            textAlign: 'center',
            borderTop: '1px solid #2A2418',
          }}
        >
          <p
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '10px',
              color: '#3A3028',
              letterSpacing: '1px',
              margin: 0,
            }}
          >
            © {new Date().getFullYear()} Muneri · Quelimane, Moçambique ·{' '}
            <span style={{ color: '#5A4020' }}>muneri.nativespeak.app</span>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function PremiumAtivadoPage() {
  return (
    <Suspense fallback={null}>
      <PremiumAtivadoContent />
    </Suspense>
  );
}
