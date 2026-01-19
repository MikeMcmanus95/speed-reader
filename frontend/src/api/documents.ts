import { get, post, put, del } from './client';
import type {
  Document,
  DocumentWithProgress,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  ReadingState,
  UpdateReadingStateRequest,
  Chunk,
  GetContentResponse,
} from '../types';

const API_BASE = '/api/documents';

export async function listDocuments(): Promise<DocumentWithProgress[]> {
  return get<DocumentWithProgress[]>(API_BASE);
}

export async function createDocument(request: CreateDocumentRequest): Promise<Document> {
  return post<Document, CreateDocumentRequest>(API_BASE, request);
}

export async function getDocument(id: string): Promise<Document> {
  return get<Document>(`${API_BASE}/${id}`);
}

export async function updateDocument(id: string, request: UpdateDocumentRequest): Promise<Document> {
  return put<Document, UpdateDocumentRequest>(`${API_BASE}/${id}`, request);
}

export async function deleteDocument(id: string): Promise<void> {
  return del(`${API_BASE}/${id}`);
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

export async function getDocumentContent(id: string): Promise<GetContentResponse> {
  return get<GetContentResponse>(`${API_BASE}/${id}/content`);
}
