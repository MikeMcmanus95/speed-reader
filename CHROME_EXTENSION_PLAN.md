# Chrome Extension Implementation Plan

## Overview

This document provides a detailed implementation plan for adding a Chrome extension to the RSVP speed reader app. The extension will:

- Work offline with client-side tokenization
- Sync optionally to the existing backend
- Reuse 85%+ of existing code via monorepo shared packages
- Add "Speed Read Selection" context menu feature

---

## Phase 1: Monorepo Foundation

**Goal**: Transform the project into a pnpm monorepo with shared packages.

### Step 1.1: Initialize Workspace

**Create `/pnpm-workspace.yaml`:**
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Create root `/package.json`:**
```json
{
  "name": "speed-reader-monorepo",
  "private": true,
  "version": "1.0.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "dev:web": "turbo run dev --filter=@speed-reader/web",
    "dev:extension": "turbo run dev --filter=@speed-reader/extension",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.9.3"
  },
  "engines": {
    "node": ">=18",
    "pnpm": ">=8"
  }
}
```

**Create `/turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": { "outputs": [] },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "clean": { "cache": false }
  }
}
```

**Create `/.npmrc`:**
```
shamefully-hoist=true
strict-peer-dependencies=false
link-workspace-packages=true
```

### Step 1.2: Create Package - @speed-reader/types

**Create `/packages/types/package.json`:**
```json
{
  "name": "@speed-reader/types",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.9.3"
  }
}
```

**Create `/packages/types/tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Move types from frontend:**
- Copy `frontend/src/types/token.ts` → `packages/types/src/token.ts`
- Copy `frontend/src/types/document.ts` → `packages/types/src/document.ts`
- Copy `frontend/src/types/index.ts` → `packages/types/src/index.ts`

**Create `/packages/types/src/index.ts`:**
```typescript
export * from './token';
export * from './document';
```

### Step 1.3: Create Package - @speed-reader/engine

**Create `/packages/engine/package.json`:**
```json
{
  "name": "@speed-reader/engine",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@speed-reader/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.17"
  }
}
```

**Move engine:**
- Copy `frontend/src/engine/RSVPEngine.ts` → `packages/engine/src/RSVPEngine.ts`

**Update imports in RSVPEngine.ts:**
```typescript
// Change from:
import type { Token } from '../types';

// To:
import type { Token } from '@speed-reader/types';
```

**Create `/packages/engine/src/index.ts`:**
```typescript
export { RSVPEngine } from './RSVPEngine';
export type { RSVPConfig, RSVPCallbacks } from './RSVPEngine';
```

### Step 1.4: Create Package - @speed-reader/ui

**Create `/packages/ui/package.json`:**
```json
{
  "name": "@speed-reader/ui",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./styles": "./src/styles/theme.css"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "clean": "rm -rf dist"
  },
  "peerDependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "dependencies": {
    "@speed-reader/types": "workspace:*",
    "@speed-reader/engine": "workspace:*",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-toggle": "^1.1.10",
    "@radix-ui/react-toggle-group": "^1.1.11",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.562.0",
    "motion": "^12.0.0",
    "tailwind-merge": "^3.4.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "typescript": "^5.9.3",
    "vitest": "^4.0.17"
  }
}
```

**Move components from frontend:**
```
frontend/src/components/RSVPDisplay.tsx    → packages/ui/src/components/RSVPDisplay.tsx
frontend/src/components/ControlBar.tsx     → packages/ui/src/components/ControlBar.tsx
frontend/src/components/ProgressBar.tsx    → packages/ui/src/components/ProgressBar.tsx
frontend/src/components/TimerDisplay.tsx   → packages/ui/src/components/TimerDisplay.tsx
frontend/src/components/DocumentCard.tsx   → packages/ui/src/components/DocumentCard.tsx
frontend/src/components/ui/*               → packages/ui/src/components/ui/*
frontend/src/lib/utils.ts                  → packages/ui/src/lib/utils.ts
frontend/src/index.css                     → packages/ui/src/styles/theme.css
```

**Create `/packages/ui/src/index.ts`:**
```typescript
// Components
export { RSVPDisplay } from './components/RSVPDisplay';
export { ControlBar } from './components/ControlBar';
export { ProgressBar } from './components/ProgressBar';
export { TimerDisplay } from './components/TimerDisplay';
export { DocumentCard } from './components/DocumentCard';

// UI primitives
export * from './components/ui/button';
export * from './components/ui/card';
export * from './components/ui/input';
export * from './components/ui/textarea';
export * from './components/ui/slider';
export * from './components/ui/toggle-group';

// Utilities
export { cn } from './lib/utils';
```

### Step 1.5: Create Package - @speed-reader/api-client

**Create `/packages/api-client/package.json`:**
```json
{
  "name": "@speed-reader/api-client",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@speed-reader/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.17"
  }
}
```

**Move API client:**
```
frontend/src/api/client.ts    → packages/api-client/src/client.ts
frontend/src/api/documents.ts → packages/api-client/src/documents.ts
frontend/src/api/auth.ts      → packages/api-client/src/auth.ts
```

**Create `/packages/api-client/src/adapters/web.ts`:**
```typescript
export interface FetchAdapter {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export function createWebAdapter(baseUrl: string = '/api'): FetchAdapter {
  return {
    fetch: (url: string, init?: RequestInit) =>
      fetch(`${baseUrl}${url}`, {
        ...init,
        credentials: 'include',
      }),
  };
}
```

**Create `/packages/api-client/src/adapters/extension.ts`:**
```typescript
import type { FetchAdapter } from './web';

export function createExtensionAdapter(backendUrl: string): FetchAdapter {
  return {
    fetch: async (url: string, init?: RequestInit) => {
      // Get OAuth token if available
      let token: string | undefined;
      try {
        const authResult = await chrome.identity.getAuthToken({ interactive: false });
        token = authResult.token;
      } catch {
        // No token available, proceed without auth
      }

      const headers = new Headers(init?.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      headers.set('Content-Type', 'application/json');

      return fetch(`${backendUrl}${url}`, {
        ...init,
        headers,
      });
    },
  };
}
```

**Create `/packages/api-client/src/index.ts`:**
```typescript
export { ApiError, get, post, put, del, setAccessToken, setRefreshTokenFn } from './client';
export * from './documents';
export * from './auth';
export { createWebAdapter } from './adapters/web';
export { createExtensionAdapter } from './adapters/extension';
export type { FetchAdapter } from './adapters/web';
```

### Step 1.6: Create Package - @speed-reader/config

**Create `/packages/config/package.json`:**
```json
{
  "name": "@speed-reader/config",
  "version": "1.0.0",
  "type": "module",
  "main": "./index.js",
  "exports": {
    "./tailwind": "./tailwind.preset.js",
    "./tsconfig": "./tsconfig.base.json"
  },
  "devDependencies": {
    "tailwindcss": "^4.1.18"
  }
}
```

**Create `/packages/config/tailwind.preset.js`:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        'bg-deep': 'var(--color-bg-deep)',
        'bg-base': 'var(--color-bg-base)',
        'bg-elevated': 'var(--color-bg-elevated)',
        'bg-surface': 'var(--color-bg-surface)',
        'amber-300': 'var(--color-amber-300)',
        'amber-400': 'var(--color-amber-400)',
        'amber-500': 'var(--color-amber-500)',
        'amber-600': 'var(--color-amber-600)',
        'copper-400': 'var(--color-copper-400)',
        'copper-500': 'var(--color-copper-500)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-tertiary': 'var(--color-text-tertiary)',
        border: 'var(--color-border)',
        'border-subtle': 'var(--color-border-subtle)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        serif: 'var(--font-serif)',
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },
    },
  },
};
```

**Create `/packages/config/tsconfig.base.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

### Step 1.7: Refactor Web App

**Move frontend to apps/web:**
```bash
mkdir -p apps
mv frontend apps/web
```

**Update `/apps/web/package.json`:**
```json
{
  "name": "@speed-reader/web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@speed-reader/engine": "workspace:*",
    "@speed-reader/types": "workspace:*",
    "@speed-reader/ui": "workspace:*",
    "@speed-reader/api-client": "workspace:*",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.12.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.18",
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "tailwindcss": "^4.1.18",
    "typescript": "~5.9.3",
    "vite": "^7.2.4",
    "vitest": "^4.0.17"
  }
}
```

**Update imports in web app files:**
```typescript
// In views/ReaderView.tsx, change:
import { RSVPDisplay, ControlBar, ProgressBar } from '../components';
import { RSVPEngine } from '../engine/RSVPEngine';
import type { Token } from '../types';

// To:
import { RSVPDisplay, ControlBar, ProgressBar } from '@speed-reader/ui';
import { RSVPEngine } from '@speed-reader/engine';
import type { Token } from '@speed-reader/types';
```

**Update `/apps/web/src/index.css`:**
```css
/* Import shared theme */
@import '@speed-reader/ui/styles';

/* App-specific overrides if any */
```

### Step 1.8: Validation Checklist

- [ ] `pnpm install` completes without errors
- [ ] `pnpm build` builds all packages
- [ ] `pnpm dev:web` starts web app
- [ ] Web app has identical functionality to before
- [ ] All existing tests pass

---

## Phase 2: Client-Side Tokenizer

**Goal**: Port the Go tokenizer to TypeScript for offline use.

### Step 2.1: Create Package - @speed-reader/tokenizer

**Create `/packages/tokenizer/package.json`:**
```json
{
  "name": "@speed-reader/tokenizer",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@speed-reader/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.17"
  }
}
```

**Create `/packages/tokenizer/src/constants.ts`:**
```typescript
// Pause multipliers (matching backend)
export const PAUSE_NORMAL = 1.0;
export const PAUSE_COMMA = 1.3;
export const PAUSE_SENTENCE = 1.8;
export const PAUSE_PARAGRAPH = 2.2;

// Abbreviations that don't end sentences
export const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'inc', 'ltd',
  'co', 'corp', 'st', 'ave', 'blvd', 'rd', 'ft', 'mt', 'jan', 'feb', 'mar',
  'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'mon', 'tue',
  'wed', 'thu', 'fri', 'sat', 'sun', 'no', 'vol', 'pg', 'pp', 'fig', 'ca',
  'cf', 'eg', 'ie', 'al', 'govt', 'dept', 'univ', 'assn', 'bros', 'gen',
  'rep', 'sen', 'rev', 'hon', 'pres', 'gov', 'atty', 'supt', 'det', 'rev',
]);
```

**Create `/packages/tokenizer/src/pivot.ts`:**
```typescript
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
```

**Create `/packages/tokenizer/src/tokenizer.ts`:**
```typescript
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
```

**Create `/packages/tokenizer/src/index.ts`:**
```typescript
export { tokenize, chunkTokens } from './tokenizer';
export { calculatePivot } from './pivot';
export {
  PAUSE_NORMAL,
  PAUSE_COMMA,
  PAUSE_SENTENCE,
  PAUSE_PARAGRAPH,
  ABBREVIATIONS,
} from './constants';
```

**Create `/packages/tokenizer/src/tokenizer.test.ts`:**
```typescript
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
});
```

### Step 2.2: Validation Checklist

- [ ] `pnpm --filter @speed-reader/tokenizer build` succeeds
- [ ] `pnpm --filter @speed-reader/tokenizer test` passes all tests
- [ ] Tokenize 100k words in <200ms (benchmark)
- [ ] Output matches backend tokenizer for sample texts

---

## Phase 3: Extension Infrastructure

**Goal**: Create the Chrome extension scaffold with manifest, service worker, and content script.

### Step 3.1: Create Extension Directory Structure

```
apps/extension/
├── manifest.json
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
└── src/
    ├── background/
    │   └── service-worker.ts
    ├── content/
    │   └── content-script.ts
    ├── sidepanel/
    │   ├── index.html
    │   ├── main.tsx
    │   ├── App.tsx
    │   └── views/
    │       ├── HomeView.tsx
    │       ├── ReaderView.tsx
    │       └── LibraryView.tsx
    └── storage/
        ├── db.ts
        └── sync.ts
```

### Step 3.2: Create manifest.json

**Create `/apps/extension/manifest.json`:**
```json
{
  "manifest_version": 3,
  "name": "Speed Reader RSVP",
  "version": "1.0.0",
  "description": "RSVP speed reading for any webpage. Highlight text and speed read with optimal recognition point.",

  "permissions": [
    "sidePanel",
    "contextMenus",
    "storage"
  ],

  "optional_permissions": [],

  "host_permissions": ["<all_urls>"],

  "action": {
    "default_title": "Open Speed Reader",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },

  "side_panel": {
    "default_path": "sidepanel.html"
  },

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_end"
    }
  ],

  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+Shift+R",
        "mac": "Command+Shift+R"
      },
      "description": "Open Speed Reader side panel"
    },
    "speed_read_selection": {
      "suggested_key": {
        "default": "Ctrl+Shift+S",
        "mac": "Command+Shift+S"
      },
      "description": "Speed read selected text"
    }
  },

  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

### Step 3.3: Create package.json

**Create `/apps/extension/package.json`:**
```json
{
  "name": "@speed-reader/extension",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@speed-reader/engine": "workspace:*",
    "@speed-reader/types": "workspace:*",
    "@speed-reader/ui": "workspace:*",
    "@speed-reader/api-client": "workspace:*",
    "@speed-reader/tokenizer": "workspace:*",
    "dexie": "^4.0.1",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.23",
    "@tailwindcss/vite": "^4.1.18",
    "@types/chrome": "^0.0.268",
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "tailwindcss": "^4.1.18",
    "typescript": "^5.9.3",
    "vite": "^7.2.4"
  }
}
```

### Step 3.4: Create vite.config.ts

**Create `/apps/extension/vite.config.ts`:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

### Step 3.5: Create Service Worker

**Create `/apps/extension/src/background/service-worker.ts`:**
```typescript
/// <reference types="chrome"/>

import { tokenize, chunkTokens } from '@speed-reader/tokenizer';

// Types for messages
interface SelectionMessage {
  type: 'SELECTION_RESPONSE';
  text: string;
  source: string;
}

interface LoadDocumentMessage {
  type: 'LOAD_DOCUMENT';
  docId: string;
}

// Install event: Setup context menus
chrome.runtime.onInstalled.addListener(() => {
  console.log('Speed Reader extension installed');

  // Create context menu for text selection
  chrome.contextMenus.create({
    id: 'speed-read-selection',
    title: 'Speed Read Selection',
    contexts: ['selection'],
  });

  // Create context menu for entire page
  chrome.contextMenus.create({
    id: 'speed-read-page',
    title: 'Speed Read Entire Page',
    contexts: ['page'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !tab?.windowId) return;

  if (info.menuItemId === 'speed-read-selection' && info.selectionText) {
    await handleTextSelection(info.selectionText, tab.url || 'Unknown', tab.windowId);
  } else if (info.menuItemId === 'speed-read-page') {
    // Request full page text from content script
    chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_TEXT' }, async (response) => {
      if (response?.text) {
        await handleTextSelection(response.text, tab.url || 'Unknown', tab.windowId);
      }
    });
  }
});

// Handle text selection and create document
async function handleTextSelection(text: string, source: string, windowId: number) {
  try {
    // Tokenize the text
    const tokens = tokenize(text);
    const chunks = chunkTokens(tokens);

    // Generate document ID
    const docId = crypto.randomUUID();

    // Store document metadata
    const document = {
      id: docId,
      title: extractTitle(text),
      source,
      createdAt: Date.now(),
      tokenCount: tokens.length,
      chunkCount: chunks.length,
      syncStatus: 'local' as const,
    };

    // Store in IndexedDB via message to side panel
    // (IndexedDB is easier to access from the page context)
    await chrome.storage.local.set({
      [`doc_${docId}_meta`]: document,
      pendingDocument: docId,
    });

    // Store chunks
    for (let i = 0; i < chunks.length; i++) {
      await chrome.storage.local.set({
        [`doc_${docId}_chunk_${i}`]: chunks[i],
      });
    }

    // Update documents index
    const result = await chrome.storage.local.get('documents_index');
    const index = result.documents_index || [];
    index.unshift(document);
    await chrome.storage.local.set({ documents_index: index });

    // Open side panel
    await chrome.sidePanel.open({ windowId });

    console.log(`Created document ${docId} with ${tokens.length} tokens`);
  } catch (error) {
    console.error('Failed to process text:', error);
  }
}

// Extract a title from the first line of text
function extractTitle(text: string): string {
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length <= 50) return firstLine;
  return firstLine.substring(0, 47) + '...';
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'speed_read_selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' }, async (response) => {
        if (response?.text && tab.windowId) {
          await handleTextSelection(response.text, tab.url || 'Unknown', tab.windowId);
        }
      });
    }
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
```

### Step 3.6: Create Content Script

**Create `/apps/extension/src/content/content-script.ts`:**
```typescript
/// <reference types="chrome"/>

// Maximum text size (1MB)
const MAX_TEXT_SIZE = 1024 * 1024;

// Sanitize text to prevent XSS
function sanitizeText(text: string): string {
  return text
    // Remove any HTML tags that might have been selected
    .replace(/<[^>]*>/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim()
    // Limit size
    .substring(0, MAX_TEXT_SIZE);
}

// Extract main content from page
function extractPageText(): string {
  // Try to find article content first
  const article = document.querySelector('article');
  if (article) {
    return sanitizeText(article.innerText);
  }

  // Try common content selectors
  const selectors = [
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element instanceof HTMLElement) {
      return sanitizeText(element.innerText);
    }
  }

  // Fallback to body text
  return sanitizeText(document.body.innerText);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    sendResponse({
      text: sanitizeText(text),
      source: window.location.href,
    });
    return true;
  }

  if (message.type === 'GET_PAGE_TEXT') {
    const text = extractPageText();
    sendResponse({
      text,
      source: window.location.href,
    });
    return true;
  }

  return false;
});
```

### Step 3.7: Create Side Panel Entry

**Create `/apps/extension/src/sidepanel/index.html`:**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Speed Reader</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Literata:opsz,wght@7..72,400;7..72,500;7..72,600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

**Create `/apps/extension/src/sidepanel/main.tsx`:**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@speed-reader/ui/styles';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Step 3.8: Validation Checklist

- [ ] `pnpm --filter @speed-reader/extension build` succeeds
- [ ] Extension loads in Chrome without errors
- [ ] Context menu "Speed Read Selection" appears on right-click
- [ ] Service worker logs show on context menu click
- [ ] Side panel opens when clicking extension icon

---

## Phase 4: Local Storage Layer

**Goal**: Implement IndexedDB storage for offline document persistence.

### Step 4.1: Create IndexedDB Schema with Dexie

**Create `/apps/extension/src/storage/db.ts`:**
```typescript
import Dexie, { type Table } from 'dexie';
import type { Token } from '@speed-reader/types';

// Document stored locally
export interface LocalDocument {
  id: string;
  title: string;
  source: string;
  createdAt: number;
  updatedAt: number;
  tokenCount: number;
  chunkCount: number;
  syncStatus: 'local' | 'synced' | 'pending' | 'error';
  lastSyncedAt: number | null;
}

// Token chunk
export interface LocalChunk {
  docId: string;
  chunkIndex: number;
  tokens: Token[];
}

// Reading state
export interface LocalReadingState {
  docId: string;
  tokenIndex: number;
  wpm: number;
  chunkSize: number;
  updatedAt: number;
  lastSyncedAt: number | null;
}

// Dexie database class
export class SpeedReaderDB extends Dexie {
  documents!: Table<LocalDocument, string>;
  chunks!: Table<LocalChunk, [string, number]>;
  readingStates!: Table<LocalReadingState, string>;

  constructor() {
    super('SpeedReaderDB');

    this.version(1).stores({
      documents: 'id, createdAt, updatedAt, syncStatus',
      chunks: '[docId+chunkIndex], docId',
      readingStates: 'docId, updatedAt',
    });
  }
}

// Singleton database instance
export const db = new SpeedReaderDB();

// Document operations
export async function saveDocument(doc: LocalDocument): Promise<void> {
  await db.documents.put(doc);
}

export async function getDocument(id: string): Promise<LocalDocument | undefined> {
  return db.documents.get(id);
}

export async function getAllDocuments(): Promise<LocalDocument[]> {
  return db.documents.orderBy('updatedAt').reverse().toArray();
}

export async function deleteDocument(id: string): Promise<void> {
  await db.transaction('rw', [db.documents, db.chunks, db.readingStates], async () => {
    await db.documents.delete(id);
    await db.chunks.where('docId').equals(id).delete();
    await db.readingStates.delete(id);
  });
}

// Chunk operations
export async function saveChunks(docId: string, chunks: Token[][]): Promise<void> {
  const localChunks: LocalChunk[] = chunks.map((tokens, index) => ({
    docId,
    chunkIndex: index,
    tokens,
  }));
  await db.chunks.bulkPut(localChunks);
}

export async function getChunk(docId: string, chunkIndex: number): Promise<LocalChunk | undefined> {
  return db.chunks.get([docId, chunkIndex]);
}

export async function getAllChunks(docId: string): Promise<Token[]> {
  const chunks = await db.chunks.where('docId').equals(docId).sortBy('chunkIndex');
  return chunks.flatMap(c => c.tokens);
}

// Reading state operations
export async function saveReadingState(state: LocalReadingState): Promise<void> {
  await db.readingStates.put(state);

  // Also save to chrome.storage.sync for cross-device sync
  try {
    await chrome.storage.sync.set({
      [`reading_${state.docId}`]: {
        tokenIndex: state.tokenIndex,
        wpm: state.wpm,
        chunkSize: state.chunkSize,
        updatedAt: state.updatedAt,
      },
    });
  } catch (error) {
    console.warn('Failed to sync reading state to chrome.storage.sync:', error);
  }
}

export async function getReadingState(docId: string): Promise<LocalReadingState | undefined> {
  // Check local first
  const local = await db.readingStates.get(docId);

  // Check chrome.storage.sync for potentially newer state
  try {
    const result = await chrome.storage.sync.get(`reading_${docId}`);
    const synced = result[`reading_${docId}`];

    if (synced && (!local || synced.updatedAt > local.updatedAt)) {
      // Sync has newer state
      const merged: LocalReadingState = {
        docId,
        tokenIndex: synced.tokenIndex,
        wpm: synced.wpm,
        chunkSize: synced.chunkSize,
        updatedAt: synced.updatedAt,
        lastSyncedAt: synced.updatedAt,
      };
      await db.readingStates.put(merged);
      return merged;
    }
  } catch (error) {
    console.warn('Failed to check chrome.storage.sync:', error);
  }

  return local;
}

// Storage info
export async function getStorageInfo(): Promise<{
  documentCount: number;
  totalTokens: number;
  estimatedSize: number;
}> {
  const documents = await db.documents.count();
  const chunks = await db.chunks.toArray();
  const totalTokens = chunks.reduce((sum, c) => sum + c.tokens.length, 0);

  // Rough size estimate (100 bytes per token on average)
  const estimatedSize = totalTokens * 100;

  return {
    documentCount: documents,
    totalTokens,
    estimatedSize,
  };
}
```

### Step 4.2: Validation Checklist

- [ ] Can create documents in IndexedDB
- [ ] Can retrieve documents and chunks
- [ ] Reading state syncs to chrome.storage.sync
- [ ] Can delete documents (cascades to chunks and states)

---

## Phase 5: Side Panel UI

**Goal**: Build the React-based side panel with reader, library, and home views.

### Step 5.1: Create App Component

**Create `/apps/extension/src/sidepanel/App.tsx`:**
```typescript
import { useState, useEffect } from 'react';
import { HomeView } from './views/HomeView';
import { ReaderView } from './views/ReaderView';
import { LibraryView } from './views/LibraryView';

type View = 'home' | 'reader' | 'library';

export function App() {
  const [view, setView] = useState<View>('home');
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);

  // Listen for new documents from background script
  useEffect(() => {
    const checkPendingDocument = async () => {
      const result = await chrome.storage.local.get('pendingDocument');
      if (result.pendingDocument) {
        setCurrentDocId(result.pendingDocument);
        setView('reader');
        await chrome.storage.local.remove('pendingDocument');
      }
    };

    checkPendingDocument();

    // Listen for storage changes
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.pendingDocument?.newValue) {
        setCurrentDocId(changes.pendingDocument.newValue);
        setView('reader');
        chrome.storage.local.remove('pendingDocument');
      }
    };

    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  const handleNavigate = (newView: View, docId?: string) => {
    if (docId) setCurrentDocId(docId);
    setView(newView);
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {view === 'home' && (
        <HomeView onNavigate={handleNavigate} />
      )}
      {view === 'reader' && currentDocId && (
        <ReaderView
          docId={currentDocId}
          onBack={() => setView('library')}
        />
      )}
      {view === 'library' && (
        <LibraryView
          onSelect={(docId) => handleNavigate('reader', docId)}
          onBack={() => setView('home')}
        />
      )}
    </div>
  );
}
```

### Step 5.2: Create HomeView

**Create `/apps/extension/src/sidepanel/views/HomeView.tsx`:**
```typescript
import { useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Library } from 'lucide-react';
import { Button, Textarea } from '@speed-reader/ui';
import { tokenize, chunkTokens } from '@speed-reader/tokenizer';
import { saveDocument, saveChunks } from '../../storage/db';

interface HomeViewProps {
  onNavigate: (view: 'home' | 'reader' | 'library', docId?: string) => void;
}

export function HomeView({ onNavigate }: HomeViewProps) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;

    setIsProcessing(true);
    try {
      // Tokenize
      const tokens = tokenize(text);
      const chunks = chunkTokens(tokens);

      // Create document
      const docId = crypto.randomUUID();
      const now = Date.now();

      await saveDocument({
        id: docId,
        title: title.trim() || extractTitle(text),
        source: 'manual',
        createdAt: now,
        updatedAt: now,
        tokenCount: tokens.length,
        chunkCount: chunks.length,
        syncStatus: 'local',
        lastSyncedAt: null,
      });

      await saveChunks(docId, chunks);

      onNavigate('reader', docId);
    } catch (error) {
      console.error('Failed to create document:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-4">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          Speed Reader
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate('library')}
          className="gap-2"
        >
          <Library className="w-4 h-4" />
          Library
        </Button>
      </motion.header>

      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 flex flex-col gap-4"
      >
        <div className="space-y-2">
          <label className="text-sm text-text-secondary">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title..."
            className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
        </div>

        <div className="flex-1 flex flex-col space-y-2">
          <label className="text-sm text-text-secondary">
            Paste text to speed read
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here, or use the right-click menu to speed read selected text from any webpage..."
            className="flex-1 min-h-[200px] resize-none"
          />
        </div>

        <div className="flex items-center justify-between text-sm text-text-tertiary">
          <span>{text.length.toLocaleString()} characters</span>
          <span>{text.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!text.trim() || isProcessing}
          className="w-full"
        >
          {isProcessing ? 'Processing...' : 'Start Reading'}
        </Button>
      </motion.main>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-4 text-center text-xs text-text-tertiary"
      >
        Tip: Highlight text on any webpage and right-click → "Speed Read Selection"
      </motion.footer>
    </div>
  );
}

function extractTitle(text: string): string {
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length <= 50) return firstLine;
  return firstLine.substring(0, 47) + '...';
}
```

### Step 5.3: Create ReaderView

**Create `/apps/extension/src/sidepanel/views/ReaderView.tsx`:**
```typescript
import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { RSVPDisplay, ControlBar, ProgressBar, Button } from '@speed-reader/ui';
import { RSVPEngine, type RSVPConfig } from '@speed-reader/engine';
import type { Token } from '@speed-reader/types';
import {
  getDocument,
  getChunk,
  getReadingState,
  saveReadingState,
  type LocalDocument,
} from '../../storage/db';

interface ReaderViewProps {
  docId: string;
  onBack: () => void;
}

const TOKENS_PER_CHUNK = 5000;
const SAVE_INTERVAL = 5000;

export function ReaderView({ docId, onBack }: ReaderViewProps) {
  const [document, setDocument] = useState<LocalDocument | null>(null);
  const [currentTokens, setCurrentTokens] = useState<Token[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [config, setConfig] = useState<RSVPConfig>({ wpm: 300, chunkSize: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<RSVPEngine | null>(null);
  const loadedChunksRef = useRef<Set<number>>(new Set());
  const positionRef = useRef(position);
  const configRef = useRef(config);
  const hasLoadedStateRef = useRef(false);

  // Initialize engine
  useEffect(() => {
    const engine = new RSVPEngine({
      onTokenChange: (tokens) => setCurrentTokens(tokens),
      onStateChange: (playing) => setIsPlaying(playing),
      onPositionChange: (index) => setPosition(index),
      onNeedMoreTokens: (chunkIndex) => {
        if (!loadedChunksRef.current.has(chunkIndex)) {
          loadChunk(chunkIndex);
        }
      },
    });

    engineRef.current = engine;
    return () => engine.destroy();
  }, [docId]);

  // Load document and initial state
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const doc = await getDocument(docId);
        if (!doc) {
          setError('Document not found');
          return;
        }
        setDocument(doc);

        // Load reading state
        const state = await getReadingState(docId);
        if (state) {
          setConfig({ wpm: state.wpm, chunkSize: state.chunkSize });
          engineRef.current?.setConfig({ wpm: state.wpm, chunkSize: state.chunkSize });
        }

        // Load first chunk
        const chunk0 = await getChunk(docId, 0);
        if (chunk0) {
          loadedChunksRef.current.add(0);
          engineRef.current?.setTokens(chunk0.tokens, 0, doc.tokenCount, TOKENS_PER_CHUNK);
        }

        // If saved position is in a different chunk, load that too
        if (state && state.tokenIndex >= TOKENS_PER_CHUNK) {
          const savedChunkIndex = Math.floor(state.tokenIndex / TOKENS_PER_CHUNK);
          if (!loadedChunksRef.current.has(savedChunkIndex)) {
            const savedChunk = await getChunk(docId, savedChunkIndex);
            if (savedChunk) {
              loadedChunksRef.current.add(savedChunkIndex);
              engineRef.current?.setTokens(
                savedChunk.tokens,
                savedChunkIndex,
                doc.tokenCount,
                TOKENS_PER_CHUNK
              );
            }
          }
        }

        // Set position after chunks are loaded
        if (state) {
          engineRef.current?.setPosition(state.tokenIndex);
        }

        hasLoadedStateRef.current = true;
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
        setLoading(false);
      }
    }

    load();
  }, [docId]);

  // Load chunk
  const loadChunk = useCallback(async (chunkIndex: number) => {
    if (loadedChunksRef.current.has(chunkIndex)) return;

    try {
      const chunk = await getChunk(docId, chunkIndex);
      if (chunk && document) {
        loadedChunksRef.current.add(chunkIndex);
        engineRef.current?.setTokens(
          chunk.tokens,
          chunkIndex,
          document.tokenCount,
          TOKENS_PER_CHUNK
        );
      }
    } catch (err) {
      console.error(`Failed to load chunk ${chunkIndex}:`, err);
    }
  }, [docId, document]);

  // Auto-save reading state
  useEffect(() => {
    const save = () => {
      if (!hasLoadedStateRef.current) return;
      saveReadingState({
        docId,
        tokenIndex: positionRef.current,
        wpm: configRef.current.wpm,
        chunkSize: configRef.current.chunkSize,
        updatedAt: Date.now(),
        lastSyncedAt: null,
      }).catch(console.error);
    };

    const interval = setInterval(save, SAVE_INTERVAL);
    return () => {
      clearInterval(interval);
      save(); // Final save on unmount
    };
  }, [docId]);

  // Keep refs in sync
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { configRef.current = config; }, [config]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          engineRef.current?.toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          engineRef.current?.setPosition(position - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          engineRef.current?.setPosition(position + 10);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [position]);

  const handlePlayPause = useCallback(() => {
    engineRef.current?.toggle();
  }, []);

  const handleWpmChange = useCallback((wpm: number) => {
    setConfig((prev) => ({ ...prev, wpm }));
    engineRef.current?.setConfig({ wpm });
  }, []);

  const handleChunkSizeChange = useCallback((chunkSize: number) => {
    setConfig((prev) => ({ ...prev, chunkSize }));
    engineRef.current?.setConfig({ chunkSize });
  }, []);

  const handleSeek = useCallback((pos: number) => {
    engineRef.current?.setPosition(pos);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text-secondary font-rsvp italic">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-vignette">
      <header className="flex items-center gap-2 px-3 py-2 bg-bg-elevated/80 backdrop-blur-sm border-b border-border-subtle">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="flex-1 text-sm font-medium truncate">
          {document?.title}
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <RSVPDisplay tokens={currentTokens} />
      </main>

      <footer className="flex flex-col gap-3 p-3 bg-bg-elevated/80 backdrop-blur-sm border-t border-border-subtle">
        <ProgressBar
          current={position}
          total={document?.tokenCount || 0}
          onSeek={handleSeek}
        />
        <ControlBar
          isPlaying={isPlaying}
          wpm={config.wpm}
          chunkSize={config.chunkSize}
          onPlayPause={handlePlayPause}
          onWpmChange={handleWpmChange}
          onChunkSizeChange={handleChunkSizeChange}
        />
      </footer>
    </div>
  );
}
```

### Step 5.4: Create LibraryView

**Create `/apps/extension/src/sidepanel/views/LibraryView.tsx`:**
```typescript
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Trash2, Clock } from 'lucide-react';
import { Button, Card } from '@speed-reader/ui';
import { getAllDocuments, deleteDocument, type LocalDocument } from '../../storage/db';

interface LibraryViewProps {
  onSelect: (docId: string) => void;
  onBack: () => void;
}

export function LibraryView({ onSelect, onBack }: LibraryViewProps) {
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    const docs = await getAllDocuments();
    setDocuments(docs);
    setLoading(false);
  }

  async function handleDelete(e: React.MouseEvent, docId: string) {
    e.stopPropagation();
    if (confirm('Delete this document?')) {
      await deleteDocument(docId);
      await loadDocuments();
    }
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-lg font-semibold">Library</h1>
        <span className="text-sm text-text-tertiary">
          ({documents.length} documents)
        </span>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-text-secondary">Loading...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-text-secondary">No documents yet</p>
          <Button onClick={onBack}>Create Your First</Button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {documents.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="p-3 cursor-pointer hover:bg-bg-elevated/80 transition-colors"
                onClick={() => onSelect(doc.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-medium truncate">{doc.title}</h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                      <span>{doc.tokenCount.toLocaleString()} words</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(doc.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-text-tertiary hover:text-destructive"
                    onClick={(e) => handleDelete(e, doc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 5.5: Validation Checklist

- [ ] Side panel renders without errors
- [ ] Can paste text and create document
- [ ] Reader displays and plays tokens
- [ ] Reading state saves and restores
- [ ] Library shows all documents
- [ ] Can delete documents
- [ ] Context menu selection flows to reader

---

## Phase 6: Background Sync (Optional)

**Goal**: Enable optional sync to the backend for cross-device access.

### Step 6.1: Create Sync Module

**Create `/apps/extension/src/storage/sync.ts`:**
```typescript
import { createExtensionAdapter } from '@speed-reader/api-client';
import { db, type LocalDocument } from './db';

const BACKEND_URL = 'https://your-backend.com/api'; // Configure via settings

export interface SyncStatus {
  isOnline: boolean;
  lastSync: number | null;
  pendingCount: number;
  error: string | null;
}

class SyncManager {
  private adapter = createExtensionAdapter(BACKEND_URL);
  private syncInterval: number | null = null;

  async getSyncStatus(): Promise<SyncStatus> {
    const pendingDocs = await db.documents
      .where('syncStatus')
      .equals('pending')
      .count();

    const lastSync = await chrome.storage.local.get('lastSync');

    return {
      isOnline: navigator.onLine,
      lastSync: lastSync.lastSync || null,
      pendingCount: pendingDocs,
      error: null,
    };
  }

  async syncAll(): Promise<void> {
    if (!navigator.onLine) return;

    // Get pending documents
    const pendingDocs = await db.documents
      .where('syncStatus')
      .equals('pending')
      .toArray();

    for (const doc of pendingDocs) {
      try {
        await this.syncDocument(doc);
      } catch (error) {
        console.error(`Failed to sync document ${doc.id}:`, error);
        await db.documents.update(doc.id, { syncStatus: 'error' });
      }
    }

    await chrome.storage.local.set({ lastSync: Date.now() });
  }

  private async syncDocument(doc: LocalDocument): Promise<void> {
    // Upload document to backend
    const response = await this.adapter.fetch('/documents', {
      method: 'POST',
      body: JSON.stringify({
        id: doc.id,
        title: doc.title,
        tokenCount: doc.tokenCount,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }

    // Mark as synced
    await db.documents.update(doc.id, {
      syncStatus: 'synced',
      lastSyncedAt: Date.now(),
    });
  }

  startPeriodicSync(intervalMs: number = 60000): void {
    this.stopPeriodicSync();
    this.syncInterval = window.setInterval(() => this.syncAll(), intervalMs);
  }

  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const syncManager = new SyncManager();
```

### Step 6.2: Validation Checklist

- [ ] Sync status indicator shows in UI
- [ ] Documents marked as "pending" upload when online
- [ ] Handles network errors gracefully
- [ ] Periodic sync runs in background

---

## Phase 7: Polish & Testing

**Goal**: Finalize the extension for production.

### Step 7.1: Create Extension Icons

Create icons at these sizes in `/apps/extension/public/icons/`:
- `icon-16.png` - Toolbar (small)
- `icon-32.png` - Toolbar (high DPI)
- `icon-48.png` - Extension management
- `icon-128.png` - Chrome Web Store

**Design Guidelines**:
- Use amber (#f0a623) as primary color on dark background
- Simple book or eye symbol for recognition
- Match "Nocturnal Scholar" aesthetic

### Step 7.2: Bundle Optimization

Add to vite.config.ts:
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'motion'],
        ui: ['@speed-reader/ui'],
      },
    },
  },
  chunkSizeWarningLimit: 500,
},
```

### Step 7.3: E2E Testing

Install Playwright:
```bash
pnpm --filter @speed-reader/extension add -D @playwright/test
```

Create test file `/apps/extension/tests/e2e/extension.test.ts`:
```typescript
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

const extensionPath = path.resolve(__dirname, '../../dist');

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
});

test.afterAll(async () => {
  await context.close();
});

test('extension loads and opens side panel', async () => {
  const page = await context.newPage();
  await page.goto('https://example.com');

  // Click extension icon
  // (Implementation depends on how to access extension UI in Playwright)

  // Verify side panel content
  // ...
});

test('context menu creates document from selection', async () => {
  const page = await context.newPage();
  await page.goto('https://example.com');

  // Select text
  await page.locator('p').first().selectText();

  // Right-click and select context menu
  // (Simulating context menu in Playwright requires special handling)

  // Verify document created
  // ...
});
```

### Step 7.4: Documentation Update

Update `/CLAUDE.md` with extension section (already partially done).

### Step 7.5: Final Validation Checklist

- [ ] Extension loads without console errors
- [ ] All features work offline
- [ ] Bundle size < 1MB
- [ ] Icons display correctly at all sizes
- [ ] Context menu works on various websites
- [ ] Reading state persists across sessions
- [ ] Side panel responsive at different widths
- [ ] Keyboard shortcuts work (Space, Arrow keys)
- [ ] Performance: tokenize 100k words < 200ms
- [ ] Memory usage stable during long sessions

---

## Summary

### Files to Create/Modify

**Root:**
- `/package.json` (new)
- `/pnpm-workspace.yaml` (new)
- `/turbo.json` (new)
- `/.npmrc` (new)

**Packages (all new):**
- `/packages/types/*` - TypeScript types
- `/packages/engine/*` - RSVPEngine
- `/packages/ui/*` - React components + theme
- `/packages/api-client/*` - HTTP client with adapters
- `/packages/tokenizer/*` - Client-side tokenizer
- `/packages/config/*` - Shared configs

**Web App (refactored):**
- `/apps/web/*` - Moved from `/frontend`, updated imports

**Extension (all new):**
- `/apps/extension/manifest.json`
- `/apps/extension/package.json`
- `/apps/extension/vite.config.ts`
- `/apps/extension/src/background/service-worker.ts`
- `/apps/extension/src/content/content-script.ts`
- `/apps/extension/src/sidepanel/*`
- `/apps/extension/src/storage/*`
- `/apps/extension/public/icons/*`

### Estimated Effort

| Phase | Days |
|-------|------|
| Phase 1: Monorepo Foundation | 3-4 |
| Phase 2: Client-Side Tokenizer | 2-3 |
| Phase 3: Extension Infrastructure | 2-3 |
| Phase 4: Local Storage Layer | 2-3 |
| Phase 5: Side Panel UI | 3-4 |
| Phase 6: Background Sync (Optional) | 2-3 |
| Phase 7: Polish & Testing | 2-3 |
| **Total** | **16-23** |

### Key Dependencies

```
@speed-reader/extension
├── @speed-reader/engine (pure TS, no deps)
├── @speed-reader/types (pure TS, no deps)
├── @speed-reader/ui (react, radix, motion)
├── @speed-reader/api-client (depends on types)
├── @speed-reader/tokenizer (depends on types)
├── dexie (IndexedDB wrapper)
└── @crxjs/vite-plugin (build only)
```

### Success Criteria

1. **Offline-first**: Extension works completely offline
2. **Code reuse**: 85%+ shared with web app
3. **Performance**: Tokenization < 200ms for 100k words
4. **UX**: Seamless context menu → reader flow
5. **Bundle size**: < 1MB uncompressed
6. **Stability**: No memory leaks during long sessions
