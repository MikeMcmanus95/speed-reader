import { useCallback, useRef } from 'react';
import './ProgressBar.css';

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
    <div className="progress-container">
      <div className="progress-bar" ref={progressRef} onClick={handleClick}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
        <div className="progress-handle" style={{ left: `${progress}%` }} />
      </div>
      <div className="progress-text">{formatProgress()}</div>
    </div>
  );
}
