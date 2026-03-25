import type {Metadata, Viewport} from 'next';
import {PwaRegistrar} from '@/components/PwaRegistrar';
import 'temml/dist/Temml-Local.css';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Muneri · Markdown para Word',
  description: 'Editor Markdown com exportação para Word e equações OMML, agora instalável como PWA.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Muneri',
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
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0f0e0d' },
    { media: '(prefers-color-scheme: light)', color: '#f5f0e8' },
  ],
  colorScheme: 'dark light',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
