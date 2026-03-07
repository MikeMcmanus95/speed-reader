export interface User {
  id: string;
  email?: string;
  name: string;
  avatarUrl?: string;
  isGuest: boolean;
  createdAt: string;
  updatedAt: string;
  settings?: UserSettings;
}

export type FontSize = 'small' | 'medium' | 'large';

export interface PauseMultipliers {
  comma: number;
  sentence: number;
  paragraph: number;
}

export interface UserSettings {
  defaultWpm: number;
  defaultChunkSize: number;
  autoPlayOnOpen: boolean;
  pauseMultipliers: PauseMultipliers;
  fontSize: FontSize;
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultWpm: 300,
  defaultChunkSize: 1,
  autoPlayOnOpen: false,
  pauseMultipliers: {
    comma: 1.3,
    sentence: 1.8,
    paragraph: 2.2,
  },
  fontSize: 'medium',
};

export type UpdateSettingsRequest = Partial<UserSettings>;

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
