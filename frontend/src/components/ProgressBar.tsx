import { useCallback, useRef } from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  onSeek: (position: number) => void;
}

export function ProgressBar({ current, total, onSeek }: ProgressBarProps) {
  const progressRef = useRef<HTMLDivElement>(null);

  const progress = total > 0 ? (current / total) * 100 : 0;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || total === 0) return;

      const rect = progressRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      const position = Math.floor(percentage * total);

      onSeek(Math.max(0, Math.min(position, total - 1)));
    },
    [total, onSeek]
  );

  const formatProgress = () => {
    if (total === 0) return '0 / 0';
    return `${current + 1} / ${total}`;
  };

  return (
    <div className="w-full px-4">
      <div
        className="relative h-2 bg-bg-surface rounded-full cursor-pointer overflow-visible group"
        ref={progressRef}
        onClick={handleClick}
      >
        <div
          className="h-full bg-amber-500 rounded-full transition-[width] duration-100 ease-out group-hover:bg-amber-400"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 w-4 h-4 bg-amber-400 border-2 border-bg-deep rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(240,166,35,0.4)] pointer-events-none group-hover:shadow-[0_0_12px_rgba(240,166,35,0.6)] group-hover:scale-110 transition-all"
          style={{ left: `${progress}%` }}
        />
      </div>
      <div className="mt-2 text-center text-sm font-counter text-text-tertiary">
        {formatProgress()}
      </div>
    </div>
  );
}
