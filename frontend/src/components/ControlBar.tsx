import './ControlBar.css';

interface ControlBarProps {
  isPlaying: boolean;
  wpm: number;
  chunkSize: number;
  onPlayPause: () => void;
  onWpmChange: (wpm: number) => void;
  onChunkSizeChange: (size: number) => void;
}

export function ControlBar({
  isPlaying,
  wpm,
  chunkSize,
  onPlayPause,
  onWpmChange,
  onChunkSizeChange,
}: ControlBarProps) {
  return (
    <div className="control-bar">
      <button
        className="play-pause-button"
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      <div className="control-group">
        <label className="control-label">
          <span className="control-label-text">WPM</span>
          <input
            type="range"
            className="wpm-slider"
            min="100"
            max="1000"
            step="25"
            value={wpm}
            onChange={(e) => onWpmChange(Number(e.target.value))}
          />
          <span className="control-value">{wpm}</span>
        </label>
      </div>

      <div className="control-group">
        <span className="control-label-text">Words</span>
        <div className="chunk-toggle">
          {[1, 2, 3, 4].map((size) => (
            <button
              key={size}
              className={`chunk-button ${chunkSize === size ? 'active' : ''}`}
              onClick={() => onChunkSizeChange(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
