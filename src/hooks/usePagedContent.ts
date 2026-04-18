'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PagedBlock {
  id: string;
  html: string;
  measuredHeight: number;
}

export interface PagedContentPage {
  blocks: PagedBlock[];
  pageNumber: number;
}

const CONTENT_HEIGHT = 749;

export function usePagedContent(htmlContent: string) {
  const measureContainerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PagedContentPage[]>([{ blocks: [], pageNumber: 1 }]);

  const paginate = useCallback(() => {
    const container = measureContainerRef.current;
    if (!container) return;

    const children = Array.from(container.children) as HTMLElement[];

    if (children.length === 0) {
      setPages([{ blocks: [], pageNumber: 1 }]);
      return;
    }

    const paginated: PagedContentPage[] = [];
    let currentBlocks: PagedBlock[] = [];
    let currentHeight = 0;

    children.forEach((child, index) => {
      const measuredHeight = Math.ceil(child.getBoundingClientRect().height);
      const block: PagedBlock = {
        id: `block-${index}`,
        html: child.outerHTML,
        measuredHeight,
      };

      if (currentHeight + measuredHeight <= CONTENT_HEIGHT) {
        currentBlocks.push(block);
        currentHeight += measuredHeight;
        return;
      }

      if (currentBlocks.length > 0) {
        paginated.push({ blocks: currentBlocks, pageNumber: paginated.length + 1 });
      }

      if (measuredHeight > CONTENT_HEIGHT) {
        paginated.push({ blocks: [block], pageNumber: paginated.length + 1 });
        currentBlocks = [];
        currentHeight = 0;
      } else {
        currentBlocks = [block];
        currentHeight = measuredHeight;
      }
    });

    if (currentBlocks.length > 0) {
      paginated.push({ blocks: currentBlocks, pageNumber: paginated.length + 1 });
    }

    setPages(paginated.length > 0 ? paginated : [{ blocks: [], pageNumber: 1 }]);
  }, []);

  useEffect(() => {
    let frameB = 0;
    const frameA = requestAnimationFrame(() => {
      frameB = requestAnimationFrame(() => paginate());
    });

    return () => {
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
    };
  }, [htmlContent, paginate]);

  return { pages, measureContainerRef };
}
