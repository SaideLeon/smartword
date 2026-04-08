import type {Metadata, Viewport} from 'next';
import {PwaRegistrar} from '@/components/PwaRegistrar';
import { AppAlertModal } from '@/components/AppAlertModal';
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
  themeColor: '#0f0e0d',
  colorScheme: 'dark',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
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
