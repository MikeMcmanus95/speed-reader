import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { chunkTokens, tokenize } from './tokenizer';

interface TokenizerFixtureCase {
  name: string;
  input: string;
  chunkSize: number;
  expectedTokens: unknown[];
  expectedChunkLengths: number[];
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

const fixturePath = path.resolve(__dirname, '../../../harness/evals/tokenizer-fixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { cases: TokenizerFixtureCase[] };

describe('Harness eval: tokenizer fixtures', () => {
  for (const fixture of fixtures.cases) {
    it(fixture.name, () => {
      const tokens = tokenize(fixture.input);
      const chunks = chunkTokens(tokens, fixture.chunkSize);

      expect(stableStringify(tokens)).toBe(stableStringify(fixture.expectedTokens));
      expect(chunks.map(chunk => chunk.length)).toEqual(fixture.expectedChunkLengths);
    });
  }
});
