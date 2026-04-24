import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Muneri | Trabalhos académicos e documentos prontos para entregar',
  description:
    'Crie trabalhos, TCC e relatórios com mais rapidez e menos stress. O Muneri ajuda a organizar o conteúdo, estruturar o documento e exportar em Word.',
  keywords: [
    'trabalhos académicos',
    'tcc',
    'relatórios',
    'estudantes',
    'documento word',
    'plataforma académica',
    'muneri',
    'moçambique',
  ],
  alternates: {
    canonical: '/landing',
  },
  openGraph: {
    title: 'Muneri | Trabalhos académicos e documentos prontos para entregar',
    description:
      'Plataforma para estudantes e profissionais criarem documentos com estrutura clara, apoio inteligente e exportação em Word.',
    url: '/landing',
    siteName: 'Muneri',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Muneri | Trabalhos académicos e documentos prontos para entregar',
    description:
      'Menos tempo em detalhes técnicos, mais foco no conteúdo. Crie e exporte documentos com padrão profissional.',
  },
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return children;
}
