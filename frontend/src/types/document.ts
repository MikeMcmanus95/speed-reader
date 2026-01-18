export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface Document {
  id: string;
  title: string;
  status: DocumentStatus;
  tokenCount: number;
  chunkCount: number;
  createdAt: string;
}

export interface ReadingState {
  docId: string;
  tokenIndex: number;
  wpm: number;
  chunkSize: number;
  updatedAt: string;
}

export interface CreateDocumentRequest {
  title: string;
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
}
