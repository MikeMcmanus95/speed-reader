import { RSVPDisplay } from '@speed-reader/ui';
import type { Token } from '@speed-reader/types';

interface ExtensionRSVPDisplayProps {
  tokens: Token[];
}

/**
 * Wrapper around RSVPDisplay that applies extension-specific font sizes.
 * The sidepanel is typically 300-400px wide (below the md: breakpoint),
 * so we need larger font sizes than mobile defaults for comfortable RSVP reading.
 */
export function ExtensionRSVPDisplay({ tokens }: ExtensionRSVPDisplayProps) {
  return (
    <div className="extension-rsvp-display">
      <RSVPDisplay tokens={tokens} />
    </div>
  );
}
