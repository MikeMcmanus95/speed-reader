import type { DocumentWithProgress, Token } from '@speed-reader/types';
import {
  db,
  type LocalDocument,
  saveDocument,
  saveChunks,
  getDocument,
  getAllDocuments,
  getPendingDocuments,
  updateDocumentSyncStatus,
  getChunk,
  hasLocalChunks,
} from '../storage/db';
import { ExtensionApiClient } from '../api/client';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: number | null;
  pendingCount: number;
  error: string | null;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  errors: Array<{ docId: string; error: string }>;
}

type SyncListener = (status: SyncStatus) => void;

/**
 * Manages synchronization between local IndexedDB and backend
 */
export class SyncManager {
  private apiClient: ExtensionApiClient;
  private status: SyncStatus = {
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSync: null,
    pendingCount: 0,
    error: null,
  };
  private listeners: Set<SyncListener> = new Set();

  constructor(apiClient: ExtensionApiClient) {
    this.apiClient = apiClient;

    // Listen for online/offline events
    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));

    // Initialize pending count
    this.updatePendingCount();
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.status));
  }

  private updateOnlineStatus(isOnline: boolean) {
    this.status = { ...this.status, isOnline };
    this.notifyListeners();
  }

  private async updatePendingCount() {
    const pending = await getPendingDocuments();
    this.status = { ...this.status, pendingCount: pending.length };
    this.notifyListeners();
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Perform a full sync: upload pending local docs, download backend metadata
   */
  async syncAll(): Promise<SyncResult> {
    if (this.status.isSyncing) {
      return { uploaded: 0, downloaded: 0, errors: [] };
    }

    if (!this.status.isOnline) {
      return { uploaded: 0, downloaded: 0, errors: [{ docId: '', error: 'Offline' }] };
    }

    this.status = { ...this.status, isSyncing: true, error: null };
    this.notifyListeners();

    const result: SyncResult = { uploaded: 0, downloaded: 0, errors: [] };

    try {
      // Step 1: Upload all pending local documents
      const pendingDocs = await getPendingDocuments();
      for (const doc of pendingDocs) {
        try {
          await this.uploadDocument(doc);
          result.uploaded++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({ docId: doc.id, error: message });
          await updateDocumentSyncStatus(doc.id, 'error');
        }
      }

      // Step 2: Download all backend document metadata
      const backendDocs = await this.apiClient.listDocuments();
      for (const backendDoc of backendDocs) {
        try {
          await this.mergeBackendDocument(backendDoc);
          result.downloaded++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({ docId: backendDoc.id, error: message });
        }
      }

      // Update last sync time
      const lastSync = Date.now();
      await chrome.storage.local.set({ lastSync });
      this.status = {
        ...this.status,
        isSyncing: false,
        lastSync,
        error: result.errors.length > 0 ? `${result.errors.length} errors` : null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      this.status = { ...this.status, isSyncing: false, error: message };
    }

    await this.updatePendingCount();
    this.notifyListeners();

    return result;
  }

  /**
   * Upload a local document to the backend
   */
  async uploadDocument(doc: LocalDocument): Promise<void> {
    if (!doc.content) {
      throw new Error('Document has no content to upload');
    }

    // Create document on backend
    const backendDoc = await this.apiClient.createDocument({
      title: doc.title,
      content: doc.content,
    });

    // Update local document with backend ID and sync status
    await updateDocumentSyncStatus(doc.id, 'synced', backendDoc.id, Date.now());
  }

  /**
   * Merge a backend document into local storage
   * Uses last-write-wins based on timestamps
   */
  private async mergeBackendDocument(backendDoc: DocumentWithProgress): Promise<void> {
    const localDoc = await getDocument(backendDoc.id);
    const backendCreatedAt = new Date(backendDoc.createdAt).getTime();
    const backendUpdatedAt = new Date(backendDoc.updatedAt).getTime();

    if (!localDoc) {
      // New document from backend - save metadata only (no tokens yet)
      const newDoc: LocalDocument = {
        id: backendDoc.id,
        title: backendDoc.title,
        source: 'backend',
        content: '', // Will be fetched on-demand if needed
        createdAt: backendCreatedAt,
        updatedAt: backendUpdatedAt,
        tokenCount: backendDoc.tokenCount,
        chunkCount: backendDoc.chunkCount,
        syncStatus: 'synced',
        lastSyncedAt: Date.now(),
        remoteId: backendDoc.id,
      };
      await saveDocument(newDoc);
    } else if (localDoc.syncStatus === 'synced' || localDoc.syncStatus === 'local') {
      // Existing document - check for updates (last-write-wins)
      if (backendUpdatedAt > localDoc.updatedAt) {
        // Backend is newer - update metadata
        await db.documents.update(localDoc.id, {
          title: backendDoc.title,
          tokenCount: backendDoc.tokenCount,
          chunkCount: backendDoc.chunkCount,
          updatedAt: backendUpdatedAt,
          lastSyncedAt: Date.now(),
          remoteId: backendDoc.id,
        });

        // Clear local chunks so they're re-fetched with new content
        await db.chunks.where('docId').equals(localDoc.id).delete();
      }
    }
    // If local has pending changes, don't overwrite - they'll be uploaded on next sync
  }

  /**
   * Sync a single document immediately
   */
  async syncDocument(docId: string): Promise<void> {
    const doc = await getDocument(docId);
    if (!doc) {
      throw new Error('Document not found');
    }

    if (doc.syncStatus === 'pending' || doc.syncStatus === 'local') {
      await this.uploadDocument(doc);
    }

    await this.updatePendingCount();
    this.notifyListeners();
  }

  /**
   * Download tokens for a backend document on-demand
   */
  async downloadTokens(docId: string): Promise<Token[]> {
    const doc = await getDocument(docId);
    if (!doc) {
      throw new Error('Document not found');
    }

    const remoteId = doc.remoteId || docId;
    const allTokens: Token[] = [];

    // Download all chunks
    for (let i = 0; i < doc.chunkCount; i++) {
      const chunk = await this.apiClient.getTokens(remoteId, i);
      allTokens.push(...chunk.tokens);

      // Save chunk to local storage
      await db.chunks.put({
        docId: doc.id,
        chunkIndex: i,
        tokens: chunk.tokens,
      });
    }

    return allTokens;
  }

  /**
   * Download a single chunk for a backend document
   */
  async downloadChunk(docId: string, chunkIndex: number): Promise<Token[]> {
    const doc = await getDocument(docId);
    if (!doc) {
      throw new Error('Document not found');
    }

    // Check if chunk exists locally
    const localChunk = await getChunk(docId, chunkIndex);
    if (localChunk) {
      return localChunk.tokens;
    }

    // Download from backend
    const remoteId = doc.remoteId || docId;
    const chunk = await this.apiClient.getTokens(remoteId, chunkIndex);

    // Save to local storage
    await db.chunks.put({
      docId: doc.id,
      chunkIndex,
      tokens: chunk.tokens,
    });

    return chunk.tokens;
  }

  /**
   * Check if a document needs tokens downloaded
   */
  async needsTokenDownload(docId: string): Promise<boolean> {
    const doc = await getDocument(docId);
    if (!doc) return false;

    // Local documents always have tokens
    if (!doc.remoteId && doc.syncStatus === 'local') {
      return false;
    }

    // Check if we have any chunks locally
    return !(await hasLocalChunks(docId));
  }

  /**
   * Mark a document as pending sync (for local edits)
   */
  async markPending(docId: string): Promise<void> {
    await updateDocumentSyncStatus(docId, 'pending');
    await this.updatePendingCount();
    this.notifyListeners();
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

export function initializeSyncManager(apiClient: ExtensionApiClient): SyncManager {
  syncManagerInstance = new SyncManager(apiClient);
  return syncManagerInstance;
}

export function getSyncManager(): SyncManager {
  if (!syncManagerInstance) {
    throw new Error('SyncManager not initialized. Call initializeSyncManager first.');
  }
  return syncManagerInstance;
}
