import type { AuthResponse, User, ShareInfo, SharedDocument } from '../types/user';

const API_BASE = '/api/auth';

export async function createGuestUser(): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/guest`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create guest user' }));
    throw new Error(error.error);
  }

  return response.json();
}

export async function refreshToken(): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to refresh token' }));
    throw new Error(error.error);
  }

  return response.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function getCurrentUser(accessToken: string): Promise<User> {
  const response = await fetch(`${API_BASE}/me`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get user' }));
    throw new Error(error.error);
  }

  return response.json();
}

export function getGoogleAuthUrl(guestId?: string): string {
  const base = `${API_BASE}/google`;
  if (guestId) {
    return `${base}?guest_id=${guestId}`;
  }
  return base;
}

// Sharing API
const SHARE_BASE = '/api/documents';

export async function getShareInfo(
  docId: string,
  accessToken: string
): Promise<ShareInfo> {
  const response = await fetch(`${SHARE_BASE}/${docId}/share`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get share info' }));
    throw new Error(error.error);
  }

  return response.json();
}

export async function generateShareToken(
  docId: string,
  accessToken: string
): Promise<ShareInfo> {
  const response = await fetch(`${SHARE_BASE}/${docId}/share`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to generate share token' }));
    throw new Error(error.error);
  }

  return response.json();
}

export async function revokeShareToken(
  docId: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(`${SHARE_BASE}/${docId}/share`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to revoke share token' }));
    throw new Error(error.error);
  }
}

export async function setVisibility(
  docId: string,
  visibility: 'private' | 'public',
  accessToken: string
): Promise<ShareInfo> {
  const response = await fetch(`${SHARE_BASE}/${docId}/visibility`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ visibility }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to set visibility' }));
    throw new Error(error.error);
  }

  return response.json();
}

// Shared document access (no auth required)
const SHARED_BASE = '/api/shared';

export async function getSharedDocument(shareToken: string): Promise<SharedDocument> {
  const response = await fetch(`${SHARED_BASE}/${shareToken}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Shared document not found' }));
    throw new Error(error.error);
  }

  return response.json();
}
