import type {
  Document,
  DocumentWithProgress,
  Chunk,
  ReadingState,
  UpdateReadingStateRequest,
  GetContentResponse,
} from '@speed-reader/types';

/**
 * Interface for document storage operations.
 * Implemented by both LocalDocumentStorage (IndexedDB) and RemoteDocumentStorage (API).
 */
export interface IDocumentStorage {
  /**
   * Create a new document from text content.
   * @param content The text content to tokenize and store
   * @param title Optional title (random title generated if not provided)
   */
  createDocument(content: string, title?: string): Promise<Document>;

  /**
   * Get a document by ID.
   */
  getDocument(id: string): Promise<Document>;

  /**
   * List all documents with reading progress.
   */
  listDocuments(): Promise<DocumentWithProgress[]>;

  /**
   * Update a document's title and optionally content.
   * If content is provided, the document is re-tokenized.
   */
  updateDocument(id: string, title: string, content?: string): Promise<Document>;

  /**
   * Delete a document and all associated data.
   */
  deleteDocument(id: string): Promise<void>;

  /**
   * Get tokens for a specific chunk of a document.
   */
  getTokens(id: string, chunkIndex: number): Promise<Chunk>;

  /**
   * Get the current reading state for a document.
   */
  getReadingState(id: string): Promise<ReadingState>;

  /**
   * Update the reading state for a document.
   */
  updateReadingState(id: string, state: UpdateReadingStateRequest): Promise<ReadingState>;

  /**
   * Get the original content of a document for editing.
   */
  getDocumentContent(id: string): Promise<GetContentResponse>;
}

/**
 * Extended interface for local storage with migration support.
 */
export interface ILocalDocumentStorage extends IDocumentStorage {
  /**
   * Get all documents with their content for migration to remote storage.
   */
  getAllDocumentsWithContent(): Promise<Array<{ document: Document; content: string }>>;

  /**
   * Clear all documents from local storage after successful migration.
   */
  clearAllDocuments(): Promise<void>;

  /**
   * Check if there are any local documents.
   */
  hasDocuments(): Promise<boolean>;
}
