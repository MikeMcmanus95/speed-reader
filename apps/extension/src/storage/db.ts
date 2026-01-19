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
