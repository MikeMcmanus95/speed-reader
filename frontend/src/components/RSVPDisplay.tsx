import type { Token } from '../types';

interface RSVPDisplayProps {
  tokens: Token[];
}

export function RSVPDisplay({ tokens }: RSVPDisplayProps) {
  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] p-8 relative">
        <div className="text-3xl md:text-5xl font-mono font-medium tracking-wide whitespace-nowrap">
          <span className="text-neutral-600">Ready</span>
        </div>
      </div>
    );
  }

  // For multi-word chunk mode, display words with spaces
  if (tokens.length > 1) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] p-8 relative">
        <div
          data-testid="rsvp-chunk"
          className="text-2xl md:text-3xl font-mono font-medium tracking-wide whitespace-nowrap"
        >
          {tokens.map((token, idx) => (
            <span key={idx} className="text-neutral-800">
              {token.text}
              {idx < tokens.length - 1 && ' '}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Single word with pivot highlighting
  const token = tokens[0];
  const { text, pivot } = token;

  // Split word into before, pivot character, and after
  const before = text.slice(0, pivot);
  const pivotChar = text[pivot] || '';
  const after = text.slice(pivot + 1);

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 relative">
      <div className="text-3xl md:text-5xl font-mono font-medium tracking-wide whitespace-nowrap">
        <span data-testid="rsvp-before" className="text-neutral-800">{before}</span>
        <span data-testid="rsvp-pivot" className="text-accent-500 font-bold">{pivotChar}</span>
        <span data-testid="rsvp-after" className="text-neutral-800">{after}</span>
      </div>
      <div
        data-testid="rsvp-focus-line"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-6 w-0.5 h-6 bg-accent-500 opacity-50"
      />
    </div>
  );
}
