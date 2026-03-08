/// <reference types="chrome"/>

import { Readability } from '@mozilla/readability';

// Maximum text size (1MB)
const MAX_TEXT_SIZE = 1024 * 1024;

const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'canvas',
  'iframe',
  'nav',
  'footer',
  'aside',
  '[role="complementary"]',
  '[aria-label*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="cookie" i]',
  '[class*="advert" i]',
  '[id*="advert" i]',
  '[class*="sponsor" i]',
  '[id*="sponsor" i]',
].join(',');

const BOILERPLATE_LINE_PATTERNS = [
  /^copyright\b/i,
  /^©/i,
  /\b(all rights reserved|privacy policy|terms of use)\b/i,
  /\b(advertisement|sponsored content|ad choices)\b/i,
  /\b(cookie policy|cookie preferences)\b/i,
  /\b(subscribe|newsletter)\b/i,
];

type PageExtraction = {
  text: string;
  title: string;
};

function sanitizeText(text: string): string {
  const normalized = text
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '');

  const lines = normalized
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return lines.join('\n').substring(0, MAX_TEXT_SIZE).trim();
}

function sanitizePageText(text: string): string {
  const lines = sanitizeText(text)
    .split('\n')
    .filter(line => !isBoilerplateLine(line));

  return lines.join('\n').substring(0, MAX_TEXT_SIZE).trim();
}

function sanitizeTitle(title: string): string {
  const cleaned = title.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Untitled Page';
  if (cleaned.length <= 120) return cleaned;
  return `${cleaned.substring(0, 117)}...`;
}

function isBoilerplateLine(line: string): boolean {
  if (line.length > 180) return false;
  return BOILERPLATE_LINE_PATTERNS.some(pattern => pattern.test(line));
}

function stripNoiseNodes(doc: Document): void {
  doc.querySelectorAll(NOISE_SELECTORS).forEach(node => node.remove());

  // Remove obvious ad/cookie/promotional wrappers that often survive selector stripping.
  doc.querySelectorAll<HTMLElement>('*').forEach(node => {
    const attrs = `${node.id} ${node.className}`.toLowerCase();
    if (/(^|[\s_-])(ad|ads|advert|advertisement|sponsor|promo|cookie|newsletter|subscribe|social|share)([\s_-]|$)/.test(attrs)) {
      node.remove();
    }
  });
}

function extractWithReadability(): PageExtraction | null {
  try {
    const docClone = document.cloneNode(true) as Document;
    stripNoiseNodes(docClone);

    const article = new Readability(docClone, { charThreshold: 200 }).parse();
    if (!article?.textContent) return null;

    const text = sanitizePageText(article.textContent);
    if (!text) return null;

    return {
      text,
      title: sanitizeTitle(article.title || document.title || window.location.hostname),
    };
  } catch (error) {
    console.warn('Readability extraction failed, falling back to selector extraction:', error);
    return null;
  }
}

function extractWithSelectors(): PageExtraction | null {
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
  ];

  let best = '';

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (!element || !(element instanceof HTMLElement)) continue;

    const candidate = sanitizePageText(element.innerText);
    if (candidate.length > best.length) {
      best = candidate;
    }
  }

  if (!best) return null;

  return {
    text: best,
    title: sanitizeTitle(document.title || window.location.hostname),
  };
}

// Extract main content from page
function extractPageText(): PageExtraction {
  const readabilityResult = extractWithReadability();
  if (readabilityResult) {
    return readabilityResult;
  }

  const selectorResult = extractWithSelectors();
  if (selectorResult) {
    return selectorResult;
  }

  return {
    text: sanitizePageText(document.body.innerText),
    title: sanitizeTitle(document.title || window.location.hostname),
  };
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
    const extraction = extractPageText();
    sendResponse({
      text: extraction.text,
      title: extraction.title,
      source: window.location.href,
    });
    return true;
  }

  return false;
});
