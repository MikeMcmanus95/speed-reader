import type { Token } from '@speed-reader/types';
import { calculatePivot } from './pivot';
import {
  PAUSE_NORMAL,
  PAUSE_COMMA,
  PAUSE_SENTENCE,
  PAUSE_PARAGRAPH,
  ABBREVIATIONS,
} from './constants';

/**
 * Normalize text by cleaning up whitespace and special characters.
 */
function normalizeText(text: string): string {
  return text
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Replace tabs with spaces
    .replace(/\t/g, ' ')
    // Normalize multiple spaces
    .replace(/ {2,}/g, ' ')
    // Trim lines
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Normalize multiple blank lines to paragraph breaks
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Split text into paragraphs.
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Check if a word followed by a period is an abbreviation.
 */
function isAbbreviation(word: string): boolean {
  const lower = word.toLowerCase().replace(/\.$/, '');
  return ABBREVIATIONS.has(lower);
}

/**
 * Determine the pause multiplier for a word based on trailing punctuation.
 */
function getPauseMultiplier(word: string, isLastInSentence: boolean, isLastInParagraph: boolean): number {
  if (isLastInParagraph) return PAUSE_PARAGRAPH;
  if (isLastInSentence) return PAUSE_SENTENCE;

  // Check for comma
  if (word.endsWith(',') || word.endsWith(';') || word.endsWith(':')) {
    return PAUSE_COMMA;
  }

  return PAUSE_NORMAL;
}

/**
 * Check if a word ends a sentence.
 */
function isSentenceEnd(word: string, nextWord?: string): boolean {
  const sentenceEnders = /[.!?]$/;

  if (!sentenceEnders.test(word)) return false;

  // Check for abbreviations
  if (word.endsWith('.') && isAbbreviation(word)) {
    return false;
  }

  // Check if next word starts with lowercase (likely not a new sentence)
  if (nextWord && /^[a-z]/.test(nextWord)) {
    return false;
  }

  return true;
}

/**
 * Extract words from a paragraph.
 */
function extractWords(paragraph: string): string[] {
  return paragraph
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Tokenize text into an array of tokens with pivot points and pause multipliers.
 */
export function tokenize(text: string): Token[] {
  const normalized = normalizeText(text);
  const paragraphs = splitParagraphs(normalized);
  const tokens: Token[] = [];

  let sentenceIndex = 0;
  let paragraphIndex = 0;

  for (const paragraph of paragraphs) {
    const words = extractWords(paragraph);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const nextWord = words[i + 1];
      const isLastWord = i === words.length - 1;

      const isSentenceEnding = isSentenceEnd(word, nextWord);
      const isParagraphEnding = isLastWord;

      tokens.push({
        text: word,
        pivot: calculatePivot(word),
        isSentenceEnd: isSentenceEnding,
        isParagraphEnd: isParagraphEnding,
        pauseMultiplier: getPauseMultiplier(word, isSentenceEnding, isParagraphEnding),
        sentenceIndex,
        paragraphIndex,
      });

      if (isSentenceEnding) {
        sentenceIndex++;
      }
    }

    paragraphIndex++;
  }

  return tokens;
}

/**
 * Chunk tokens into arrays of specified size.
 */
export function chunkTokens(tokens: Token[], chunkSize: number = 5000): Token[][] {
  const chunks: Token[][] = [];
  for (let i = 0; i < tokens.length; i += chunkSize) {
    chunks.push(tokens.slice(i, i + chunkSize));
  }
  return chunks;
}
