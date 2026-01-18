import { motion, AnimatePresence } from 'motion/react';
import type { Token } from '../types';

interface RSVPDisplayProps {
  tokens: Token[];
}

export function RSVPDisplay({ tokens }: RSVPDisplayProps) {
  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] p-8 relative">
        <div className="text-3xl md:text-5xl font-rsvp font-medium tracking-wide whitespace-nowrap">
          <span className="text-text-tertiary italic">Ready</span>
        </div>
      </div>
    );
  }

  // Generate a key based on token content for animation
  const tokenKey = tokens.map(t => t.text).join('-');

  // For multi-word chunk mode, display words with spaces
  if (tokens.length > 1) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] p-8 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={tokenKey}
            data-testid="rsvp-chunk"
            className="text-2xl md:text-4xl font-rsvp font-medium tracking-wide whitespace-nowrap"
            initial={{ opacity: 0.7, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {tokens.map((token, idx) => (
              <span key={idx} className="text-text-primary">
                {token.text}
                {idx < tokens.length - 1 && ' '}
              </span>
            ))}
          </motion.div>
        </AnimatePresence>
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
      <AnimatePresence mode="wait">
        <motion.div
          key={tokenKey}
          className="text-3xl md:text-5xl font-rsvp font-medium tracking-wide whitespace-nowrap"
          initial={{ opacity: 0.7, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <span data-testid="rsvp-before" className="text-text-primary">{before}</span>
          <span
            data-testid="rsvp-pivot"
            className="text-copper-400 font-semibold animate-pivot-glow"
          >
            {pivotChar}
          </span>
          <span data-testid="rsvp-after" className="text-text-primary">{after}</span>
        </motion.div>
      </AnimatePresence>
      <div
        data-testid="rsvp-focus-line"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-8 w-0.5 h-5 bg-copper-400/40 rounded-full"
      />
    </div>
  );
}
