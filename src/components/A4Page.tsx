'use client';

import type { ReactNode } from 'react';

interface A4PageProps {
  pageNumber: number;
  totalPages: number;
  children: ReactNode;
  themeMode: 'dark' | 'light';
}

const PAGE_HEIGHT = 877;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 64;
const MARGIN_LEFT = 72;
const MARGIN_RIGHT = 58;

export function A4Page({ pageNumber, totalPages, children, themeMode }: A4PageProps) {
  return (
    <article
      style={{
        position: 'relative',
        width: '620px',
        minHeight: `${PAGE_HEIGHT}px`,
        backgroundColor: 'white',
        color: '#111',
        boxShadow: themeMode === 'dark' ? '0 4px 28px rgba(0,0,0,0.56)' : '0 4px 24px rgba(0,0,0,0.32)',
        paddingTop: `${MARGIN_TOP}px`,
        paddingBottom: `${MARGIN_BOTTOM}px`,
        paddingLeft: `${MARGIN_LEFT}px`,
        paddingRight: `${MARGIN_RIGHT}px`,
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: '15px',
        lineHeight: '1.8',
        overflow: 'hidden',
      }}
    >
      <div style={{ minHeight: `${PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM}px` }}>{children}</div>

      <footer
        style={{
          position: 'absolute',
          bottom: '24px',
          left: `${MARGIN_LEFT}px`,
          right: `${MARGIN_RIGHT}px`,
          textAlign: 'center',
          fontSize: '12px',
          color: '#666',
          fontFamily: '"Times New Roman", serif',
        }}
      >
        {pageNumber}
        <span style={{ color: '#9a9a9a' }}> / {totalPages}</span>
      </footer>
    </article>
  );
}
