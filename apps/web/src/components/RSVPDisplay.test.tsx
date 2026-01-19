import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RSVPDisplay } from './RSVPDisplay';
import type { Token } from '@speed-reader/types';

describe('RSVPDisplay', () => {
  const createToken = (
    text: string,
    pivot: number,
    overrides: Partial<Token> = {}
  ): Token => ({
    text,
    pivot,
    isSentenceEnd: false,
    isParagraphEnd: false,
    pauseMultiplier: 1.0,
    sentenceIndex: 0,
    paragraphIndex: 0,
    ...overrides,
  });

  describe('empty state', () => {
    it('should show Ready placeholder when no tokens', () => {
      render(<RSVPDisplay tokens={[]} />);
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });

  describe('single word display', () => {
    it('should render a single word with pivot highlighting', () => {
      const token = createToken('Hello', 1);
      render(<RSVPDisplay tokens={[token]} />);

      // Check that the word is rendered
      expect(screen.getByText('H')).toBeInTheDocument(); // before pivot
      expect(screen.getByText('e')).toBeInTheDocument(); // pivot
      expect(screen.getByText('llo')).toBeInTheDocument(); // after pivot
    });

    it('should highlight pivot character with correct test id', () => {
      const token = createToken('Hello', 1);
      render(<RSVPDisplay tokens={[token]} />);

      const pivotElement = screen.getByTestId('rsvp-pivot');
      expect(pivotElement).toBeInTheDocument();
      expect(pivotElement.textContent).toBe('e');
    });

    it('should render before-pivot text with correct test id', () => {
      const token = createToken('Hello', 1);
      render(<RSVPDisplay tokens={[token]} />);

      const beforeElement = screen.getByTestId('rsvp-before');
      expect(beforeElement).toBeInTheDocument();
      expect(beforeElement.textContent).toBe('H');
    });

    it('should render after-pivot text with correct test id', () => {
      const token = createToken('Hello', 1);
      render(<RSVPDisplay tokens={[token]} />);

      const afterElement = screen.getByTestId('rsvp-after');
      expect(afterElement).toBeInTheDocument();
      expect(afterElement.textContent).toBe('llo');
    });
  });

  describe('pivot edge cases', () => {
    it('should handle pivot at start of word', () => {
      const token = createToken('Hi', 0);
      render(<RSVPDisplay tokens={[token]} />);

      const beforeElement = screen.getByTestId('rsvp-before');
      const pivotElement = screen.getByTestId('rsvp-pivot');
      const afterElement = screen.getByTestId('rsvp-after');

      expect(beforeElement.textContent).toBe('');
      expect(pivotElement.textContent).toBe('H');
      expect(afterElement.textContent).toBe('i');
    });

    it('should handle single character word', () => {
      const token = createToken('I', 0);
      render(<RSVPDisplay tokens={[token]} />);

      const pivotElement = screen.getByTestId('rsvp-pivot');
      expect(pivotElement.textContent).toBe('I');
    });
  });

  describe('chunk mode display', () => {
    it('should display multiple words in chunk mode', () => {
      const tokens = [
        createToken('Hello', 1),
        createToken('world', 2),
      ];
      render(<RSVPDisplay tokens={tokens} />);

      expect(screen.getByText(/Hello/)).toBeInTheDocument();
      expect(screen.getByText(/world/)).toBeInTheDocument();
    });

    it('should have chunk test id for multi-word display', () => {
      const tokens = [
        createToken('Hello', 1),
        createToken('world', 2),
      ];
      render(<RSVPDisplay tokens={tokens} />);

      const chunkElement = screen.getByTestId('rsvp-chunk');
      expect(chunkElement).toBeInTheDocument();
    });
  });

  describe('focus line', () => {
    it('should render focus line for single word mode', () => {
      const token = createToken('Hello', 1);
      render(<RSVPDisplay tokens={[token]} />);

      const focusLine = screen.getByTestId('rsvp-focus-line');
      expect(focusLine).toBeInTheDocument();
    });

    it('should not render focus line for empty state', () => {
      render(<RSVPDisplay tokens={[]} />);

      const focusLine = screen.queryByTestId('rsvp-focus-line');
      expect(focusLine).not.toBeInTheDocument();
    });
  });
});
