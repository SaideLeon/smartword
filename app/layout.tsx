import type {Metadata, Viewport} from 'next';
import {PwaRegistrar} from '@/components/PwaRegistrar';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'docx · Markdown para Word',
  description: 'Editor Markdown com exportação para Word e equações OMML, agora instalável como PWA.',
  manifest: '/manifest.webmanifest',
  applicationName: 'docx',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'docx',
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
