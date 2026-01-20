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
    title: 'Speed Read Entire Page',
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
        handleTextSelection(response.text, tab.url || 'Unknown', true);
      }
    });
  }
});

// Handle text selection and create document
async function handleTextSelection(text: string, source: string, autoPlay: boolean = false) {
  try {
    // Tokenize the text
    const tokens = tokenize(text);
    const chunks = chunkTokens(tokens);

    // Generate document ID
    const docId = crypto.randomUUID();
    const now = Date.now();

    // Check if user is authenticated
    const authResult = await chrome.storage.local.get('auth_state');
    const isAuthenticated = !!authResult.auth_state?.accessToken;

    // Create document object
    const doc: LocalDocument = {
      id: docId,
      title: extractTitle(text),
      source,
      content: text, // Store raw content for syncing
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
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length <= 50) return firstLine;
  return firstLine.substring(0, 47) + '...';
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
