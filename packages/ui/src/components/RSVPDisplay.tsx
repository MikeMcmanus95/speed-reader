import React, { useRef, useLayoutEffect, useState, useCallback } from 'react';
import type { Token } from '@speed-reader/types';

type FontSizeSetting = 'small' | 'medium' | 'large';

interface RSVPDisplayProps {
  tokens: Token[];
  fontSize?: FontSizeSetting;
}

const fontSizeClasses: Record<FontSizeSetting, { single: string; multi: string; ready: string }> = {
  small: {
    single: 'text-2xl md:text-4xl',
    multi: 'text-xl md:text-3xl',
    ready: 'text-2xl md:text-4xl',
  },
  medium: {
    single: 'text-3xl md:text-5xl',
    multi: 'text-2xl md:text-4xl',
    ready: 'text-3xl md:text-5xl',
  },
  large: {
    single: 'text-4xl md:text-6xl',
    multi: 'text-3xl md:text-5xl',
    ready: 'text-4xl md:text-6xl',
  },
};

// Singleton canvas for text measurements (avoids memory leak from repeated canvas creation)
let measurementCanvas: HTMLCanvasElement | null = null;

/**
 * Measures the rendered width of text given a computed font string.
 * Uses canvas context for accurate proportional font measurements.
 */
function measureTextWidth(text: string, font: string): number {
  if (!measurementCanvas) {
    measurementCanvas = document.createElement('canvas');
  }
  const context = measurementCanvas.getContext('2d');
  if (!context) return 0;
  context.font = font;
  return context.measureText(text).width;
}

export const RSVPDisplay = React.memo(function RSVPDisplay({ tokens, fontSize = 'medium' }: RSVPDisplayProps) {
  const sizeClasses = fontSizeClasses[fontSize];
  const wordRef = useRef<HTMLDivElement>(null);
  const [pivotOffset, setPivotOffset] = useState<number>(0);

  // Only process single-word mode
  const token = tokens.length === 1 ? tokens[0] : null;

  // Calculate offset to center pivot character on focus line
  const calculateOffset = useCallback(() => {
    if (!token || !wordRef.current) {
      setPivotOffset(0);
      return;
    }

    const { text, pivot } = token;
    const before = text.slice(0, pivot);
    const pivotChar = text[pivot] || '';

    // Get computed font from the word element
    const computedStyle = window.getComputedStyle(wordRef.current);
    const font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;

    // Measure widths
    const beforeWidth = before ? measureTextWidth(before, font) : 0;
    const pivotWidth = pivotChar ? measureTextWidth(pivotChar, font) : 0;
    const totalWidth = measureTextWidth(text, font);

    // The word is centered by flexbox, so its center is at screen center.
    // We need to shift so the pivot character's center aligns with screen center.
    // Pivot center is at: beforeWidth + pivotWidth/2 from left edge
    // Word center is at: totalWidth/2 from left edge
    // Shift needed: (totalWidth/2) - (beforeWidth + pivotWidth/2)
    const pivotCenterFromLeft = beforeWidth + (pivotWidth / 2);
    const wordCenter = totalWidth / 2;
    const offset = wordCenter - pivotCenterFromLeft;
    setPivotOffset(offset);
  }, [token]);

  // Measure and calculate pivot offset, also handle window resize for responsive text
  useLayoutEffect(() => {
    calculateOffset();

    // Recalculate on resize to handle responsive font size changes (md: breakpoint)
    window.addEventListener('resize', calculateOffset);
    return () => window.removeEventListener('resize', calculateOffset);
  }, [calculateOffset]);

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] p-8 relative">
        <div className={`${sizeClasses.ready} font-rsvp font-medium tracking-wide whitespace-nowrap`}>
          <span className="text-text-tertiary italic">Ready</span>
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
          className={`${sizeClasses.multi} font-rsvp font-medium tracking-wide whitespace-nowrap`}
        >
          {tokens.map((tkn, idx) => (
            <span key={idx} className="text-text-primary">
              {tkn.text}
              {idx < tokens.length - 1 && ' '}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Single word with pivot highlighting
  const { text, pivot } = token!;
  const before = text.slice(0, pivot);
  const pivotChar = text[pivot] || '';
  const after = text.slice(pivot + 1);

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 relative">
      <div
        ref={wordRef}
        className={`${sizeClasses.single} font-rsvp font-medium tracking-wide whitespace-nowrap`}
        style={{ transform: `translateX(${pivotOffset}px)` }}
      >
        <span data-testid="rsvp-before" className="text-text-primary">{before}</span>
        <span
          data-testid="rsvp-pivot"
          className="text-copper-400 font-semibold animate-pivot-glow"
        >
          {pivotChar}
        </span>
        <span data-testid="rsvp-after" className="text-text-primary">{after}</span>
      </div>
      <div
        data-testid="rsvp-focus-line"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-8 w-0.5 h-5 bg-copper-400/40 rounded-full"
      />
    </div>
  );
});
