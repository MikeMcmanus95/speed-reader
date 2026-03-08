/// <reference types="chrome"/>

import { tokenize, chunkTokens } from '@speed-reader/tokenizer';
import { saveDocument, saveChunks, type LocalDocument } from '../storage/db';

// Keep extracted payloads bounded to avoid oversized storage writes.
const MAX_TEXT_SIZE = 1024 * 1024;

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
    title: 'Speed Read entire page',
    contexts: ['page'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleContextMenuClick(info, tab);
});

async function handleContextMenuClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) {
  if (!tab?.id || !tab?.windowId) return;

  if (info.menuItemId === 'speed-read-selection' && info.selectionText) {
    // Open side panel immediately (must be synchronous for user gesture)
    void chrome.sidePanel.open({ windowId: tab.windowId });
    const selectedText = sanitizeText(info.selectionText);
    if (!selectedText) return;
    await handleTextSelection(selectedText, tab.url || 'Unknown', true, tab.title);
    return;
  }

  if (info.menuItemId === 'speed-read-page') {
    // Open side panel immediately
    void chrome.sidePanel.open({ windowId: tab.windowId });
    const pageText = await extractPageTextFromTab(tab.id);
    if (!pageText) {
      console.warn('Failed to get page text: empty result or script injection unavailable');
      return;
    }
    await handleTextSelection(pageText, tab.url || 'Unknown', true, tab.title);
  }
}

function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, MAX_TEXT_SIZE);
}

async function extractSelectionFromTab(tabId: number): Promise<string | null> {
  return executeTextScript(tabId, () => window.getSelection()?.toString() || '');
}

async function extractPageTextFromTab(tabId: number): Promise<string | null> {
  return executeTextScript(tabId, () => {
    const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();
    const selectors = [
      'article',
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
        return normalizeWhitespace(element.innerText);
      }
    }

    return normalizeWhitespace(document.body?.innerText || '');
  });
}

async function executeTextScript(tabId: number, func: () => string): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func,
      },
      (results) => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to run text extraction script:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }

        const firstResult = results?.[0]?.result;
        if (typeof firstResult !== 'string') {
          resolve(null);
          return;
        }

        const sanitized = sanitizeText(firstResult);
        resolve(sanitized || null);
      }
    );
  });
}

// Handle text selection and create document
async function handleTextSelection(
  text: string,
  source: string,
  autoPlay: boolean = false,
  preferredTitle?: string
) {
  try {
    const normalizedText = text.trim();
    if (!normalizedText) return;

    // Tokenize the text
    const tokens = tokenize(normalizedText);
    const chunks = chunkTokens(tokens);
    if (tokens.length === 0) return;

    // Generate document ID
    const docId = crypto.randomUUID();
    const now = Date.now();

    // Check if user is authenticated
    const authResult = await chrome.storage.local.get('auth_state');
    const isAuthenticated = !!authResult.auth_state?.accessToken;

    // Create document object
    const doc: LocalDocument = {
      id: docId,
      title: resolveTitle(preferredTitle, normalizedText),
      source,
      content: normalizedText, // Store raw content for syncing
      createdAt: now,
      updatedAt: now,
      tokenCount: tokens.length,
      chunkCount: chunks.length,
      // Mark as pending if authenticated (will sync), local otherwise
      syncStatus: isAuthenticated ? 'pending' : 'local',
      lastSyncedAt: null,
    };

    // Store document and chunks in IndexedDB (Dexie)
    await saveDocument(doc);
    await saveChunks(docId, chunks);

    // Set pending document flag in chrome.storage.local
    // This notifies the sidepanel to load this document
    // Combine docId and autoPlay in a single object to ensure atomicity
    // (Chrome may fire separate change events for separate keys)
    await chrome.storage.local.set({ pendingDocument: { docId, autoPlay } });

    console.log(`Created document ${docId} with ${tokens.length} tokens (autoPlay: ${autoPlay})`);

    // Notify sidepanel to trigger sync if authenticated
    if (isAuthenticated) {
      chrome.runtime.sendMessage({ type: 'DOCUMENT_CREATED', docId }).catch(() => {
        // Sidepanel might not be open, that's fine
      });
    }
  } catch (error) {
    console.error('Failed to process text:', error);
  }
}

// Extract a title from the first line of text
function extractTitle(text: string): string {
  const firstLine = text.split('\n').find(line => line.trim().length > 0)?.trim() || '';
  if (!firstLine) return 'Untitled Document';
  if (firstLine.length <= 50) return firstLine;
  return `${firstLine.substring(0, 47)}...`;
}

function resolveTitle(preferredTitle: string | undefined, text: string): string {
  const cleanedPreferred = preferredTitle?.trim();
  if (cleanedPreferred) {
    if (cleanedPreferred.length <= 80) return cleanedPreferred;
    return `${cleanedPreferred.substring(0, 77)}...`;
  }
  return extractTitle(text);
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  void handleCommand(command);
});

async function handleCommand(command: string) {
  if (command === 'speed_read_selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.windowId) {
      // Open side panel immediately (user gesture from keyboard shortcut)
      void chrome.sidePanel.open({ windowId: tab.windowId });
      const selectedText = await extractSelectionFromTab(tab.id);
      if (!selectedText) {
        console.warn('Failed to get selection: empty result or script injection unavailable');
        return;
      }
      await handleTextSelection(selectedText, tab.url || 'Unknown', true, tab.title);
    }
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
