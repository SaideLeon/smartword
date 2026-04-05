'use client';

import { motion } from 'motion/react';

interface ProcessingBarsProps {
  className?: string;
  barClassName?: string;
  barColor?: string;
  height?: number;
}

export function ProcessingBars({
  className,
  barClassName,
  barColor = '#f59e0b',
  height = 18,
}: ProcessingBarsProps) {
  return (
    <div className={className ?? 'inline-flex items-center justify-center'} aria-hidden="true">
      <div className="flex items-end gap-1" style={{ height }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className={`rounded-full ${barClassName ?? ''}`.trim()}
            style={{ width: 4, backgroundColor: barColor }}
            animate={{ height: [4, height, 4] }}
            transition={{ duration: 0.95, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
          />
        ))}
      </div>
    </div>
  );
}
