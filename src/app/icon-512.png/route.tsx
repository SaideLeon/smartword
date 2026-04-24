import { ImageResponse } from 'next/og';
import { PwaIcon } from '@/app/pwa-icon';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(<PwaIcon size={512} />, {
    width: 512,
    height: 512,
  });
}
