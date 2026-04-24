import type { Metadata, Viewport } from 'next';
import { PwaRegistrar } from '@/components/PwaRegistrar';
import { AppAlertModal } from '@/components/AppAlertModal';
import 'temml/dist/Temml-Local.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://muneri.nativespeak.app'),
  title: {
    default: 'Muneri | Plataforma para trabalhos académicos e documentos em Word',
    template: '%s | Muneri',
  },
  description:
    'O Muneri ajuda estudantes e profissionais a criar trabalhos, TCC e relatórios com estrutura clara, linguagem simples e exportação em Word.',
  applicationName: 'Muneri',
  keywords: [
    'trabalho académico',
    'tcc',
    'relatório',
    'documentos',
    'word',
    'estudantes',
    'muneri',
  ],
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Muneri | Plataforma para trabalhos académicos e documentos em Word',
    description:
      'Crie documentos com qualidade profissional sem complicação técnica. Estruture, revise e exporte em Word com o Muneri.',
    url: '/',
    siteName: 'Muneri',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Muneri | Plataforma para trabalhos académicos e documentos em Word',
    description:
      'Menos stress para produzir trabalhos e relatórios: o Muneri organiza o processo e acelera a entrega.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Muneri',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f0e0d',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body suppressHydrationWarning>
        <PwaRegistrar />
        <AppAlertModal />
        {children}
      </body>
    </html>
  );
}
