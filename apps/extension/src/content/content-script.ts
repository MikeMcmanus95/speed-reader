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
    const text = extractPageText();
    sendResponse({
      text,
      source: window.location.href,
    });
    return true;
  }

  return false;
});
