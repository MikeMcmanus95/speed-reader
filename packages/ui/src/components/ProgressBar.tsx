import React, { useCallback, useRef, useState, useEffect } from 'react';
import { TimerDisplay } from './TimerDisplay';

interface ProgressBarProps {
  current: number;
  total: number;
  onSeek: (position: number) => void;
  elapsedTime?: string;
  totalTime?: string;
}

export const ProgressBar = React.memo(function ProgressBar({ current, total, onSeek, elapsedTime, totalTime }: ProgressBarProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const progress = total > 0 ? (current / total) * 100 : 0;

  const calculatePosition = useCallback((clientX: number): number => {
    if (!progressRef.current || total === 0) return 0;

    const rect = progressRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return Math.floor(percentage * total);
  }, [total]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (total === 0) return;

      isDraggingRef.current = true;
      setIsDragging(true);

      const position = calculatePosition(e.clientX);
      onSeek(Math.max(0, Math.min(position, total - 1)));
    },
    [total, onSeek, calculatePosition]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || total === 0) return;

      // Cancel any pending RAF to prevent stacking
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        const position = calculatePosition(e.clientX);
        onSeek(Math.max(0, Math.min(position, total - 1)));
        rafIdRef.current = null;
      });
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);

        // Clean up any pending RAF
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      // Clean up RAF on unmount
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [total, onSeek, calculatePosition]);

  const formatProgress = () => {
    if (total === 0) return '0 / 0';
    return `${current + 1} / ${total}`;
  };

  return (
    <div className="w-full px-4">
      <div
        className="relative h-2 bg-bg-surface rounded-full cursor-pointer overflow-visible group"
        ref={progressRef}
        onMouseDown={handleMouseDown}
      >
        <div
          className={`h-full bg-amber-500 rounded-full group-hover:bg-amber-400 ${!isDragging && "transition-[width] duration-100 ease-out"
            }`}
          style={{ width: `${progress}%` }}
        />
        <div
          className={`absolute top-1/2 w-4 h-4 bg-amber-400 border-2 border-bg-deep rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(240,166,35,0.4)] pointer-events-none group-hover:shadow-[0_0_12px_rgba(240,166,35,0.6)] group-hover:scale-110 ${!isDragging && "transition-all"
            }`}
          style={{ left: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-sm font-counter text-text-tertiary px-1 select-none">
        <TimerDisplay elapsed={elapsedTime || '0:00'} total={totalTime || '0:00'} />
        <div className="tabular-nums">{formatProgress()}</div>
      </div>
    </div>
  );
});
