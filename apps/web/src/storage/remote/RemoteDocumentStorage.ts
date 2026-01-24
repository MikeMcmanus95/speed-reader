import type {
  Document,
  DocumentWithProgress,
  Chunk,
  ReadingState,
  UpdateReadingStateRequest,
  GetContentResponse,
} from '@speed-reader/types';
import {
  createDocument as apiCreateDocument,
  getDocument as apiGetDocument,
  listDocuments as apiListDocuments,
  updateDocument as apiUpdateDocument,
  deleteDocument as apiDeleteDocument,
  getTokens as apiGetTokens,
  getReadingState as apiGetReadingState,
  updateReadingState as apiUpdateReadingState,
  getDocumentContent as apiGetDocumentContent,
} from '@speed-reader/api-client';
import type { IDocumentStorage } from '../interfaces/IDocumentStorage';

/**
 * Remote document storage implementation using the backend API.
 * Used for authenticated users.
 */
export class RemoteDocumentStorage implements IDocumentStorage {
  async createDocument(content: string, title?: string): Promise<Document> {
    return apiCreateDocument({
      title: title ?? '',
      content,
    });
  }

  async getDocument(id: string): Promise<Document> {
    return apiGetDocument(id);
  }

  async listDocuments(): Promise<DocumentWithProgress[]> {
    return apiListDocuments();
  }

  async updateDocument(id: string, title: string, content?: string): Promise<Document> {
    return apiUpdateDocument(id, { title, content });
  }

  async deleteDocument(id: string): Promise<void> {
    return apiDeleteDocument(id);
  }

  async getTokens(id: string, chunkIndex: number): Promise<Chunk> {
    return apiGetTokens(id, chunkIndex);
  }

  async getReadingState(id: string): Promise<ReadingState> {
    return apiGetReadingState(id);
  }

  async updateReadingState(id: string, request: UpdateReadingStateRequest): Promise<ReadingState> {
    return apiUpdateReadingState(id, request);
  }

  async getDocumentContent(id: string): Promise<GetContentResponse> {
    return apiGetDocumentContent(id);
  }
}
