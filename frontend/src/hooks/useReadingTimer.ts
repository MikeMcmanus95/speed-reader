import { useMemo } from 'react';
import type { Token } from '../types';
import {
  calculateElapsedTime,
  estimateTotalTime,
  formatDuration,
} from '../utils/timer';

interface UseReadingTimerProps {
  tokens: Token[];
  currentIndex: number;
  totalTokens: number;
  wpm: number;
}

interface UseReadingTimerResult {
  elapsedFormatted: string;
  totalFormatted: string;
  elapsedMs: number;
  totalMs: number;
}

export function useReadingTimer({
  tokens,
  currentIndex,
  totalTokens,
  wpm,
}: UseReadingTimerProps): UseReadingTimerResult {
  const elapsedMs = useMemo(() => {
    if (tokens.length === 0 || currentIndex <= 0) {
      return 0;
    }
    return calculateElapsedTime(tokens, currentIndex, wpm);
  }, [tokens, currentIndex, wpm]);

  // Total time only depends on tokens and WPM, not current position
  const totalMs = useMemo(() => {
    if (tokens.length === 0) {
      return 0;
    }
    return estimateTotalTime(tokens, totalTokens, wpm);
  }, [tokens, totalTokens, wpm]);

  const elapsedFormatted = useMemo(() => formatDuration(elapsedMs), [elapsedMs]);
  const totalFormatted = useMemo(() => formatDuration(totalMs), [totalMs]);

  return {
    elapsedFormatted,
    totalFormatted,
    elapsedMs,
    totalMs,
  };
}
