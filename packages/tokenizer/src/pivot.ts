/**
 * Calculate the Optimal Recognition Point (ORP) for a word.
 * This is the character position where the eye naturally focuses.
 *
 * Based on research: ~30% into the word for optimal reading.
 */
export function calculatePivot(word: string): number {
  // Use Array.from for proper Unicode handling
  const chars = Array.from(word);
  const length = chars.length;

  if (length <= 1) return 0;
  if (length === 2) return 1;
  if (length <= 5) return Math.floor((length - 1) / 2);
  if (length <= 9) return Math.floor(length / 3);
  return Math.floor(length / 4) + 1;
}
