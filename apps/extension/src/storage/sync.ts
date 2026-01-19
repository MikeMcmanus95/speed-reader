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
