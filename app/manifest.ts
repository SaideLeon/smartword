import type {MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'docx · Markdown para Word',
    short_name: 'docx',
    description: 'Editor Markdown com exportação para Word e equações OMML, instalável como aplicação PWA.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f0e0d',
    theme_color: '#0f0e0d',
    lang: 'pt-BR',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.svg',
        sizes: '180x180',
        type: 'image/svg+xml',
      },
    ],
  };
}
