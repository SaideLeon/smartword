'use client';

import { forwardRef } from 'react';

interface PageMeasureLayerProps {
  htmlContent: string;
}

export const PageMeasureLayer = forwardRef<HTMLDivElement, PageMeasureLayerProps>(
  function PageMeasureLayer({ htmlContent }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-99999px',
          left: '-99999px',
          width: '490px',
          visibility: 'hidden',
          pointerEvents: 'none',
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: '15px',
          lineHeight: '1.8',
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  },
);
