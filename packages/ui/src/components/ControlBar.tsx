import React from 'react';
import { Play, Pause } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

interface ControlBarProps {
  isPlaying: boolean;
  wpm: number;
  chunkSize: number;
  onPlayPause: () => void;
  onWpmChange: (wpm: number) => void;
  onChunkSizeChange: (size: number) => void;
}

export const ControlBar = React.memo(function ControlBar({
  isPlaying,
  wpm,
  chunkSize,
  onPlayPause,
  onWpmChange,
  onChunkSizeChange,
}: ControlBarProps) {
  return (
    <div className="flex items-center justify-center gap-8 p-4 md:px-8 bg-bg-surface rounded-xl flex-wrap">
      <motion.div
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        <Button
          size="icon"
          onClick={onPlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-bg-deep shadow-[0_0_16px_rgba(240,166,35,0.3)] hover:shadow-[0_0_24px_rgba(240,166,35,0.5)] transition-shadow"
        >
          <motion.div
            key={isPlaying ? 'pause' : 'play'}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </motion.div>
        </Button>
      </motion.div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-counter font-medium text-text-tertiary uppercase tracking-widest">
          WPM
        </span>
        <Slider
          value={[wpm]}
          min={100}
          max={1000}
          step={25}
          onValueChange={([value]) => onWpmChange(value)}
          className="w-24 md:w-32"
        />
        <span className="min-w-12 font-counter text-sm font-semibold text-amber-400 tabular-nums">
          {wpm}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-counter font-medium text-text-tertiary uppercase tracking-widest">
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
              className="w-8 h-8 text-sm font-counter font-medium"
            >
              {size}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
});
