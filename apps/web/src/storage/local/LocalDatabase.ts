import type { Document, Token, ReadingState, DocumentWithProgress } from '@speed-reader/types';

const DB_NAME = 'speed-reader-local';
const DB_VERSION = 1;

const STORE_DOCUMENTS = 'documents';
const STORE_CHUNKS = 'chunks';
const STORE_READING_STATES = 'readingStates';

interface StoredDocument extends Document {
  content: string;
}

interface StoredChunk {
  id: string; // docId:chunkIndex
  docId: string;
  chunkIndex: number;
  tokens: Token[];
}

interface StoredReadingState extends ReadingState {
  docId: string;
}

/**
 * IndexedDB wrapper for local document storage.
 */
export class LocalDatabase {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Open the database, creating it if necessary.
   */
  private async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Documents store
        if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
          const docStore = db.createObjectStore(STORE_DOCUMENTS, { keyPath: 'id' });
          docStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Chunks store (compound key: docId + chunkIndex)
        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          const chunkStore = db.createObjectStore(STORE_CHUNKS, { keyPath: 'id' });
          chunkStore.createIndex('docId', 'docId', { unique: false });
        }

        // Reading states store
        if (!db.objectStoreNames.contains(STORE_READING_STATES)) {
          db.createObjectStore(STORE_READING_STATES, { keyPath: 'docId' });
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Save a document with its chunks and content.
   */
  async saveDocument(document: Document, chunks: Token[][], content: string): Promise<void> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_DOCUMENTS, STORE_CHUNKS], 'readwrite');
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      // Save document with content
      const docStore = transaction.objectStore(STORE_DOCUMENTS);
      const storedDoc: StoredDocument = { ...document, content };
      docStore.put(storedDoc);

      // Save chunks
      const chunkStore = transaction.objectStore(STORE_CHUNKS);
      chunks.forEach((tokens, index) => {
        const chunk: StoredChunk = {
          id: `${document.id}:${index}`,
          docId: document.id,
          chunkIndex: index,
          tokens,
        };
        chunkStore.put(chunk);
      });
    });
  }

  /**
   * Get a document by ID.
   */
  async getDocument(id: string): Promise<StoredDocument | null> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_DOCUMENTS, 'readonly');
      const store = transaction.objectStore(STORE_DOCUMENTS);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /**
   * List all documents with reading progress.
   */
  async listDocuments(): Promise<DocumentWithProgress[]> {
    const db = await this.open();

    // Get all documents
    const documents = await new Promise<StoredDocument[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_DOCUMENTS, 'readonly');
      const store = transaction.objectStore(STORE_DOCUMENTS);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });

    // Get all reading states
    const readingStates = await new Promise<StoredReadingState[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_READING_STATES, 'readonly');
      const store = transaction.objectStore(STORE_READING_STATES);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });

    // Create a map of reading states by docId
    const stateMap = new Map<string, StoredReadingState>();
    for (const state of readingStates) {
      stateMap.set(state.docId, state);
    }

    // Combine documents with their reading progress
    return documents
      .map((doc): DocumentWithProgress => {
        const state = stateMap.get(doc.id);
        return {
          id: doc.id,
          userId: doc.userId,
          title: doc.title,
          status: doc.status,
          tokenCount: doc.tokenCount,
          chunkCount: doc.chunkCount,
          visibility: doc.visibility,
          shareToken: doc.shareToken,
          expiresAt: doc.expiresAt,
          createdAt: doc.createdAt,
          hasContent: doc.hasContent,
          tokenIndex: state?.tokenIndex ?? 0,
          wpm: state?.wpm ?? 300,
          updatedAt: state?.updatedAt ?? doc.createdAt,
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Update a document's title.
   */
  async updateDocumentTitle(id: string, title: string): Promise<void> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_DOCUMENTS, 'readwrite');
      const store = transaction.objectStore(STORE_DOCUMENTS);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const doc = request.result as StoredDocument | undefined;
        if (!doc) {
          reject(new Error('Document not found'));
          return;
        }

        doc.title = title;
        const putRequest = store.put(doc);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  }

  /**
   * Update a document's content (re-tokenize).
   */
  async updateDocumentContent(
    id: string,
    title: string,
    content: string,
    tokens: Token[][],
    tokenCount: number
  ): Promise<StoredDocument> {
    const db = await this.open();

    // First, get the document and delete old chunks in a separate transaction
    const doc = await this.getDocument(id);
    if (!doc) {
      throw new Error('Document not found');
    }

    // Delete old chunks first, then update document
    await new Promise<void>((resolve, reject) => {
      const deleteTransaction = db.transaction(STORE_CHUNKS, 'readwrite');
      deleteTransaction.onerror = () => reject(deleteTransaction.error);

      const chunkStore = deleteTransaction.objectStore(STORE_CHUNKS);
      const chunkIndex = chunkStore.index('docId');
      const cursorRequest = chunkIndex.openCursor(IDBKeyRange.only(id));

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      deleteTransaction.oncomplete = () => resolve();
    });

    // Now update the document and add new chunks
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_DOCUMENTS, STORE_CHUNKS, STORE_READING_STATES], 'readwrite');
      transaction.onerror = () => reject(transaction.error);

      const docStore = transaction.objectStore(STORE_DOCUMENTS);
      const chunkStore = transaction.objectStore(STORE_CHUNKS);
      const stateStore = transaction.objectStore(STORE_READING_STATES);

      // Update document
      doc.title = title;
      doc.content = content;
      doc.tokenCount = tokenCount;
      doc.chunkCount = tokens.length;
      docStore.put(doc);

      // Save new chunks
      tokens.forEach((chunkTokens, index) => {
        const chunk: StoredChunk = {
          id: `${id}:${index}`,
          docId: id,
          chunkIndex: index,
          tokens: chunkTokens,
        };
        chunkStore.put(chunk);
      });

      // Reset reading state to beginning, preserving WPM
      const stateRequest = stateStore.get(id);
      stateRequest.onsuccess = () => {
        const existingState = stateRequest.result as StoredReadingState | undefined;
        const newState: StoredReadingState = {
          docId: id,
          tokenIndex: 0,
          wpm: existingState?.wpm ?? 300,
          chunkSize: existingState?.chunkSize ?? 1,
          updatedAt: new Date().toISOString(),
        };
        stateStore.put(newState);
      };

      transaction.oncomplete = () => resolve(doc);
    });
  }

  /**
   * Delete a document and all associated data.
   */
  async deleteDocument(id: string): Promise<void> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_DOCUMENTS, STORE_CHUNKS, STORE_READING_STATES], 'readwrite');
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      // Delete document
      transaction.objectStore(STORE_DOCUMENTS).delete(id);

      // Delete reading state
      transaction.objectStore(STORE_READING_STATES).delete(id);

      // Delete chunks
      const chunkStore = transaction.objectStore(STORE_CHUNKS);
      const index = chunkStore.index('docId');
      const request = index.openCursor(IDBKeyRange.only(id));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    });
  }

  /**
   * Get tokens for a specific chunk.
   */
  async getChunk(docId: string, chunkIndex: number): Promise<Token[] | null> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_CHUNKS, 'readonly');
      const store = transaction.objectStore(STORE_CHUNKS);
      const request = store.get(`${docId}:${chunkIndex}`);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const chunk = request.result as StoredChunk | undefined;
        resolve(chunk?.tokens ?? null);
      };
    });
  }

  /**
   * Get reading state for a document.
   */
  async getReadingState(docId: string): Promise<StoredReadingState | null> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_READING_STATES, 'readonly');
      const store = transaction.objectStore(STORE_READING_STATES);
      const request = store.get(docId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /**
   * Update reading state for a document.
   */
  async updateReadingState(state: StoredReadingState): Promise<void> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_READING_STATES, 'readwrite');
      const store = transaction.objectStore(STORE_READING_STATES);
      const request = store.put(state);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get the content of a document.
   */
  async getContent(id: string): Promise<string | null> {
    const doc = await this.getDocument(id);
    return doc?.content ?? null;
  }

  /**
   * Get all documents with their content for migration.
   */
  async getAllDocumentsWithContent(): Promise<Array<{ document: Document; content: string }>> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_DOCUMENTS, 'readonly');
      const store = transaction.objectStore(STORE_DOCUMENTS);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const docs = (request.result || []) as StoredDocument[];
        resolve(docs.map((doc) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { content, ...document } = doc;
          return { document, content };
        }));
      };
    });
  }

  /**
   * Clear all documents from local storage.
   */
  async clearAllDocuments(): Promise<void> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_DOCUMENTS, STORE_CHUNKS, STORE_READING_STATES], 'readwrite');
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      transaction.objectStore(STORE_DOCUMENTS).clear();
      transaction.objectStore(STORE_CHUNKS).clear();
      transaction.objectStore(STORE_READING_STATES).clear();
    });
  }

  /**
   * Check if there are any local documents.
   */
  async hasDocuments(): Promise<boolean> {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_DOCUMENTS, 'readonly');
      const store = transaction.objectStore(STORE_DOCUMENTS);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result > 0);
    });
  }
}
