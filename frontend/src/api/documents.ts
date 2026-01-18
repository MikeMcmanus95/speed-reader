import { get, post, put } from './client';
import type {
  Document,
  CreateDocumentRequest,
  ReadingState,
  UpdateReadingStateRequest,
  Chunk,
} from '../types';

const API_BASE = '/api/documents';

export async function createDocument(request: CreateDocumentRequest): Promise<Document> {
  return post<Document, CreateDocumentRequest>(API_BASE, request);
}

export async function getDocument(id: string): Promise<Document> {
  return get<Document>(`${API_BASE}/${id}`);
}

export async function getTokens(id: string, chunkIndex: number = 0): Promise<Chunk> {
  return get<Chunk>(`${API_BASE}/${id}/tokens?chunk=${chunkIndex}`);
}

export async function getReadingState(id: string): Promise<ReadingState> {
  return get<ReadingState>(`${API_BASE}/${id}/reading-state`);
}

export async function updateReadingState(
  id: string,
  request: UpdateReadingStateRequest
): Promise<ReadingState> {
  return put<ReadingState, UpdateReadingStateRequest>(
    `${API_BASE}/${id}/reading-state`,
    request
  );
}
