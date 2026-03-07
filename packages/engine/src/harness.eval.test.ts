import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RSVPEngine } from './RSVPEngine';
import type { Token } from '@speed-reader/types';

type TimingCase = {
  name: string;
  type: 'timing';
  wpm: number;
  chunkSize: number;
  totalTokens: number;
  tokensPerChunk: number;
  tokens: Array<{ text: string; pauseMultiplier: number }>;
  stepsMs: number[];
  expectedPositions: number[];
};

type PrefetchCase = {
  name: string;
  type: 'prefetch';
  totalTokens: number;
  tokensPerChunk: number;
  startPosition: number;
  tokens: Array<{ text: string; pauseMultiplier: number }>;
  expectedNeedMoreChunks: number[];
};

type FixtureCase = TimingCase | PrefetchCase;

const fixturePath = path.resolve(__dirname, '../../../harness/evals/engine-fixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { cases: FixtureCase[] };

function makeToken(text: string, pauseMultiplier: number): Token {
  return {
    text,
    pivot: Math.min(1, Math.max(0, text.length - 1)),
    isSentenceEnd: false,
    isParagraphEnd: false,
    pauseMultiplier,
    sentenceIndex: 0,
    paragraphIndex: 0,
  };
}

describe('Harness eval: RSVP engine fixtures', () => {
  let rafCallback: FrameRequestCallback | null = null;
  let now = 0;

  beforeEach(() => {
    now = 0;
    rafCallback = null;

    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  for (const fixture of fixtures.cases) {
    it(fixture.name, () => {
      const positions: number[] = [];
      const needs: number[] = [];
      const engine = new RSVPEngine({
        onTokenChange: () => {},
        onStateChange: () => {},
        onPositionChange: (index) => positions.push(index),
        onNeedMoreTokens: (chunk) => needs.push(chunk),
      });

      const tokens = fixture.tokens.map((token) => makeToken(token.text, token.pauseMultiplier));
      engine.setTokens(tokens, 0, fixture.totalTokens, fixture.tokensPerChunk);

      if (fixture.type === 'timing') {
        engine.setConfig({ wpm: fixture.wpm, chunkSize: fixture.chunkSize });
        engine.play();

        for (const step of fixture.stepsMs) {
          now += step;
          const cb = rafCallback;
          rafCallback = null;
          if (cb) {
            cb(now);
          }
        }

        expect(positions).toEqual(fixture.expectedPositions);
      } else {
        engine.setPosition(fixture.startPosition);
        expect(needs).toEqual(fixture.expectedNeedMoreChunks);
      }

      engine.destroy();
    });
  }
});
