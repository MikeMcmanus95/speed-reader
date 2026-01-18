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
        className="relative h-2 bg-neutral-200 rounded-md cursor-pointer overflow-visible group"
        ref={progressRef}
        onClick={handleClick}
      >
        <div
          className="h-full bg-primary-700 rounded-md transition-[width] duration-100 ease-out group-hover:bg-primary-800"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 w-4 h-4 bg-primary-700 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow-md pointer-events-none group-hover:bg-primary-800 group-hover:scale-110 transition-transform"
          style={{ left: `${progress}%` }}
        />
      </div>
      <div className="mt-2 text-center text-sm font-mono text-neutral-600">
        {formatProgress()}
      </div>
    </div>
  );
}
