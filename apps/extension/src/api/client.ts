import type {
  Document,
  DocumentWithProgress,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  ReadingState,
  UpdateReadingStateRequest,
  GetContentResponse,
  Token,
} from '@speed-reader/types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type GetAccessToken = () => Promise<string | null>;

/**
 * Extension API client for backend communication
 * Uses a callback to get the current access token
 */
export class ExtensionApiClient {
  private baseUrl: string;
  private getAccessToken: GetAccessToken;

  constructor(baseUrl: string = BACKEND_URL, getAccessToken: GetAccessToken) {
    this.baseUrl = baseUrl;
    this.getAccessToken = getAccessToken;
  }

  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(error.error || 'Request failed', response.status);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // Document operations
  async createDocument(request: CreateDocumentRequest): Promise<Document> {
    return this.fetch<Document>('/api/documents', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getDocument(id: string): Promise<Document> {
    return this.fetch<Document>(`/api/documents/${id}`);
  }

  async updateDocument(id: string, request: UpdateDocumentRequest): Promise<Document> {
    return this.fetch<Document>(`/api/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  async deleteDocument(id: string): Promise<void> {
    return this.fetch<void>(`/api/documents/${id}`, {
      method: 'DELETE',
    });
  }

  async listDocuments(): Promise<DocumentWithProgress[]> {
    return this.fetch<DocumentWithProgress[]>('/api/documents');
  }

  // Token operations
  async getTokens(id: string, chunkIndex: number): Promise<{ tokens: Token[]; chunkIndex: number }> {
    return this.fetch<{ tokens: Token[]; chunkIndex: number }>(
      `/api/documents/${id}/tokens?chunk=${chunkIndex}`
    );
  }

  // Content operations
  async getDocumentContent(id: string): Promise<GetContentResponse> {
    return this.fetch<GetContentResponse>(`/api/documents/${id}/content`);
  }

  // Reading state operations
  async getReadingState(id: string): Promise<ReadingState> {
    return this.fetch<ReadingState>(`/api/documents/${id}/reading-state`);
  }

  async updateReadingState(id: string, request: UpdateReadingStateRequest): Promise<ReadingState> {
    return this.fetch<ReadingState>(`/api/documents/${id}/reading-state`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }
}

// Singleton instance - will be initialized with auth context
let clientInstance: ExtensionApiClient | null = null;

export function initializeApiClient(getAccessToken: GetAccessToken): ExtensionApiClient {
  clientInstance = new ExtensionApiClient(BACKEND_URL, getAccessToken);
  return clientInstance;
}

export function getApiClient(): ExtensionApiClient {
  if (!clientInstance) {
    throw new Error('API client not initialized. Call initializeApiClient first.');
  }
  return clientInstance;
}
