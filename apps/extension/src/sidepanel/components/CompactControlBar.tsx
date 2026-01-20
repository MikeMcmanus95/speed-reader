import React from 'react';
import { Play, Pause } from 'lucide-react';
import { motion } from 'motion/react';
import { Button, Slider, ToggleGroup, ToggleGroupItem } from '@speed-reader/ui';

interface CompactControlBarProps {
  isPlaying: boolean;
  wpm: number;
  chunkSize: number;
  onPlayPause: () => void;
  onWpmChange: (wpm: number) => void;
  onChunkSizeChange: (size: number) => void;
}

export const CompactControlBar = React.memo(function CompactControlBar({
  isPlaying,
  wpm,
  chunkSize,
  onPlayPause,
  onWpmChange,
  onChunkSizeChange,
}: CompactControlBarProps) {
  return (
    <div className="flex flex-col gap-3 p-3 bg-bg-surface rounded-xl">
      {/* Play button and WPM row */}
      <div className="flex items-center gap-3">
        <motion.div
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <Button
            size="icon"
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-11 h-11 rounded-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-bg-deep shadow-[0_0_12px_rgba(240,166,35,0.3)] hover:shadow-[0_0_18px_rgba(240,166,35,0.5)] transition-shadow"
          >
            <motion.div
              key={isPlaying ? 'pause' : 'play'}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </motion.div>
          </Button>
        </motion.div>

        <div className="flex-1 flex items-center gap-2">
          <span className="text-[10px] font-counter font-medium text-text-tertiary uppercase tracking-widest">
            WPM
          </span>
          <Slider
            value={[wpm]}
            min={100}
            max={1000}
            step={25}
            onValueChange={([value]) => onWpmChange(value)}
            className="flex-1 min-w-20"
          />
          <span className="min-w-9 font-counter text-xs font-semibold text-amber-400 tabular-nums">
            {wpm}
          </span>
        </div>
      </div>

      {/* Chunk size row */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-[10px] font-counter font-medium text-text-tertiary uppercase tracking-widest">
          Words
        </span>
        <ToggleGroup
          type="single"
          value={String(chunkSize)}
          onValueChange={(value) => value && onChunkSizeChange(Number(value))}
          variant="outline"
        >
          {[1, 2, 3, 4].map((size) => (
            <ToggleGroupItem
              key={size}
              value={String(size)}
              aria-label={`Show ${size} word${size > 1 ? 's' : ''} at a time`}
              className="w-7 h-7 text-xs font-counter font-medium"
            >
              {size}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
});
