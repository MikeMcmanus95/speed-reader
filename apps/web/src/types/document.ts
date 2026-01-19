export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error';
export type DocumentVisibility = 'private' | 'public';

export interface Document {
  id: string;
  userId?: string;
  title: string;
  status: DocumentStatus;
  tokenCount: number;
  chunkCount: number;
  visibility: DocumentVisibility;
  shareToken?: string;
  expiresAt?: string;
  createdAt: string;
  hasContent: boolean; // True if original content is stored (for editing)
}

export interface ReadingState {
  docId: string;
  tokenIndex: number;
  wpm: number;
  chunkSize: number;
  updatedAt: string;
}

export interface CreateDocumentRequest {
  title?: string; // Optional - server will generate a fun random name if not provided
  content: string;
}

export interface UpdateReadingStateRequest {
  tokenIndex: number;
  wpm: number;
  chunkSize: number;
}

export interface DocumentWithProgress extends Document {
  tokenIndex: number;
  wpm: number;
  updatedAt: string;
}

export interface UpdateDocumentRequest {
  title: string;
  content?: string; // Optional: if provided, re-tokenizes and resets reading progress
}

export interface GetContentResponse {
  content: string;
  hasContent: boolean;
}
