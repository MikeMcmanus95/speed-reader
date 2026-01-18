import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
    <div className="flex items-center justify-center gap-8 p-4 md:px-8 bg-neutral-100 rounded-lg flex-wrap">
      <Button
        size="icon"
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="w-12 h-12 rounded-full bg-primary-700 hover:bg-primary-800 active:bg-primary-900"
      >
        {isPlaying ? (
          <Pause className="w-6 h-6" />
        ) : (
          <Play className="w-6 h-6" />
        )}
      </Button>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-neutral-600 uppercase tracking-wide">
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
        <span className="min-w-12 font-mono text-sm font-semibold text-neutral-800">
          {wpm}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-neutral-600 uppercase tracking-wide">
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
              className="w-8 h-8 text-sm font-medium data-[state=on]:bg-primary-700 data-[state=on]:text-white data-[state=on]:border-primary-700"
            >
              {size}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
