export interface User {
  id: string;
  email?: string;
  name: string;
  avatarUrl?: string;
  isGuest: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  expiresAt: string;
}

export interface ShareInfo {
  shareToken?: string;
  shareUrl?: string;
  visibility: 'private' | 'public';
}

export interface SharedDocument {
  id: string;
  title: string;
  tokenCount: number;
  chunkCount: number;
  createdAt: string;
  ownerName: string;
}
