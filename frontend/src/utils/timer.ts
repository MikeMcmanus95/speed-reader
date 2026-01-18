import type { Token } from '../types';

/**
 * Calculate the display time for a single token based on WPM and difficulty.
 * Difficulty is determined by pause multiplier (punctuation) and word length.
 */
export function calculateTokenTime(token: Token, wpm: number): number {
  const baseDelayMs = 60000 / wpm;
  const pauseMultiplier = token.pauseMultiplier || 1;
  const lengthMultiplier = Math.max(1, token.text.length / 5);

  return baseDelayMs * pauseMultiplier * lengthMultiplier;
}

/**
 * Calculate the total reading time for a range of tokens.
 */
export function calculateReadingTime(
  tokens: Token[],
  wpm: number,
  from: number = 0,
  to?: number
): number {
  const end = to ?? tokens.length;
  let totalMs = 0;

  for (let i = from; i < end && i < tokens.length; i++) {
    totalMs += calculateTokenTime(tokens[i], wpm);
  }

  return totalMs;
}

/**
 * Estimate total reading time for the entire document.
 * Uses average token time from loaded tokens to estimate unloaded portions.
 */
export function estimateTotalTime(
  loadedTokens: Token[],
  totalTokens: number,
  wpm: number
): number {
  if (loadedTokens.length === 0 || totalTokens === 0) {
    return 0;
  }

  // Calculate time for all loaded tokens
  const loadedTime = calculateReadingTime(loadedTokens, wpm);

  // Estimate time for unloaded tokens
  const unloadedTokenCount = totalTokens - loadedTokens.length;
  if (unloadedTokenCount <= 0) {
    return loadedTime;
  }

  // Calculate average time per loaded token to estimate unloaded tokens
  const avgTimePerToken = loadedTime / loadedTokens.length;
  const estimatedUnloadedTime = unloadedTokenCount * avgTimePerToken;

  return loadedTime + estimatedUnloadedTime;
}

/**
 * Calculate elapsed time from start to current position.
 */
export function calculateElapsedTime(
  tokens: Token[],
  currentIndex: number,
  wpm: number
): number {
  return calculateReadingTime(tokens, wpm, 0, currentIndex);
}

/**
 * Format milliseconds as a duration string (M:SS or H:MM:SS).
 */
export function formatDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) {
    return '0:00';
  }

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
