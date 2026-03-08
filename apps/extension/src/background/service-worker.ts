/// <reference types="chrome"/>

import { tokenize, chunkTokens } from '@speed-reader/tokenizer';
import { saveDocument, saveChunks, type LocalDocument } from '../storage/db';

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
  if (!tab?.id || !tab?.windowId) return;

  if (info.menuItemId === 'speed-read-selection' && info.selectionText) {
    // Open side panel immediately (must be synchronous for user gesture)
    chrome.sidePanel.open({ windowId: tab.windowId });
    // Then process text asynchronously with autoPlay enabled
    handleTextSelection(info.selectionText, tab.url || 'Unknown', true);
  } else if (info.menuItemId === 'speed-read-page') {
    // Open side panel immediately
    chrome.sidePanel.open({ windowId: tab.windowId });
    // Request full page text from content script
    chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_TEXT' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to get page text:', chrome.runtime.lastError.message);
        return;
      }
      if (response?.text) {
        handleTextSelection(
          response.text,
          response.source || tab.url || 'Unknown',
          true,
          response.title
        );
      }
    });
  }
});

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
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'speed_read_selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab.windowId) {
      // Open side panel immediately (user gesture from keyboard shortcut)
      chrome.sidePanel.open({ windowId: tab.windowId });
      // Then get selection and process with autoPlay enabled
      chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to get selection:', chrome.runtime.lastError.message);
          return;
        }
        if (response?.text) {
          handleTextSelection(response.text, tab.url || 'Unknown', true);
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
