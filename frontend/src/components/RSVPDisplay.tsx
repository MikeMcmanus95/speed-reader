import type { Token } from '../types';
import './RSVPDisplay.css';

interface RSVPDisplayProps {
  tokens: Token[];
}

export function RSVPDisplay({ tokens }: RSVPDisplayProps) {
  if (tokens.length === 0) {
    return (
      <div className="rsvp-display">
        <div className="rsvp-word">
          <span className="rsvp-placeholder">Ready</span>
        </div>
      </div>
    );
  }

  // For multi-word chunk mode, display words with spaces
  if (tokens.length > 1) {
    return (
      <div className="rsvp-display">
        <div className="rsvp-word rsvp-chunk">
          {tokens.map((token, idx) => (
            <span key={idx} className="rsvp-chunk-word">
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
    <div className="rsvp-display">
      <div className="rsvp-word">
        <span className="rsvp-before">{before}</span>
        <span className="rsvp-pivot">{pivotChar}</span>
        <span className="rsvp-after">{after}</span>
      </div>
      <div className="rsvp-focus-line" />
    </div>
  );
}
