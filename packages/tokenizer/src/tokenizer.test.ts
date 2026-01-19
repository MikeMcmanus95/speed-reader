import { describe, it, expect } from 'vitest';
import { tokenize, chunkTokens } from './tokenizer';
import { calculatePivot } from './pivot';

describe('calculatePivot', () => {
  it('handles single character', () => {
    expect(calculatePivot('I')).toBe(0);
  });

  it('handles two characters', () => {
    expect(calculatePivot('to')).toBe(1);
  });

  it('handles short words (3-5 chars)', () => {
    expect(calculatePivot('the')).toBe(1);
    expect(calculatePivot('hello')).toBe(2);
  });

  it('handles medium words (6-9 chars)', () => {
    expect(calculatePivot('reading')).toBe(2);
  });

  it('handles long words (10+ chars)', () => {
    expect(calculatePivot('understanding')).toBe(4);
  });
});

describe('tokenize', () => {
  it('tokenizes simple text', () => {
    const tokens = tokenize('Hello world');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].text).toBe('Hello');
    expect(tokens[1].text).toBe('world');
  });

  it('detects sentence endings', () => {
    const tokens = tokenize('Hello. World.');
    expect(tokens[0].isSentenceEnd).toBe(true);
    expect(tokens[0].pauseMultiplier).toBe(1.8);
  });

  it('handles abbreviations', () => {
    const tokens = tokenize('Dr. Smith is here.');
    expect(tokens[0].isSentenceEnd).toBe(false);
    expect(tokens[3].isSentenceEnd).toBe(true);
  });

  it('detects paragraph endings', () => {
    const tokens = tokenize('First paragraph.\n\nSecond paragraph.');
    const firstParagraphEnd = tokens.find(t => t.isParagraphEnd && t.paragraphIndex === 0);
    expect(firstParagraphEnd?.pauseMultiplier).toBe(2.2);
  });

  it('handles comma pauses', () => {
    const tokens = tokenize('Hello, world');
    expect(tokens[0].text).toBe('Hello,');
    expect(tokens[0].pauseMultiplier).toBe(1.3);
  });

  it('calculates pivot points correctly', () => {
    const tokens = tokenize('understanding');
    expect(tokens[0].pivot).toBe(4);
  });

  it('tracks sentence indices', () => {
    const tokens = tokenize('First sentence. Second sentence.');
    expect(tokens[0].sentenceIndex).toBe(0);
    expect(tokens[1].sentenceIndex).toBe(0);
    expect(tokens[2].sentenceIndex).toBe(1);
    expect(tokens[3].sentenceIndex).toBe(1);
  });

  it('tracks paragraph indices', () => {
    const tokens = tokenize('First para.\n\nSecond para.');
    expect(tokens[0].paragraphIndex).toBe(0);
    expect(tokens[1].paragraphIndex).toBe(0);
    expect(tokens[2].paragraphIndex).toBe(1);
    expect(tokens[3].paragraphIndex).toBe(1);
  });
});

describe('chunkTokens', () => {
  it('chunks tokens correctly', () => {
    const tokens = Array.from({ length: 12000 }, (_, i) => ({
      text: `word${i}`,
      pivot: 0,
      isSentenceEnd: false,
      isParagraphEnd: false,
      pauseMultiplier: 1,
      sentenceIndex: 0,
      paragraphIndex: 0,
    }));

    const chunks = chunkTokens(tokens, 5000);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(5000);
    expect(chunks[1]).toHaveLength(5000);
    expect(chunks[2]).toHaveLength(2000);
  });

  it('handles small inputs', () => {
    const tokens = Array.from({ length: 100 }, (_, i) => ({
      text: `word${i}`,
      pivot: 0,
      isSentenceEnd: false,
      isParagraphEnd: false,
      pauseMultiplier: 1,
      sentenceIndex: 0,
      paragraphIndex: 0,
    }));

    const chunks = chunkTokens(tokens, 5000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(100);
  });

  it('handles empty input', () => {
    const chunks = chunkTokens([], 5000);
    expect(chunks).toHaveLength(0);
  });
});
