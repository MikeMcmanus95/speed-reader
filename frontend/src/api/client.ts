export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Token management
let accessToken: string | null = null;
let refreshTokenFn: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setRefreshTokenFn(fn: () => Promise<string | null>) {
  refreshTokenFn = fn;
}

// Extract CSRF token from cookies
function getCSRFToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function getAuthHeaders(includeCSRF: boolean = false): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Add CSRF token for state-changing requests
  if (includeCSRF) {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return headers;
}

async function handleResponse<T>(response: Response, retryFn?: () => Promise<T>): Promise<T> {
  if (response.status === 401 && refreshTokenFn && retryFn) {
    // Try to refresh the token and retry
    const newToken = await refreshTokenFn();
    if (newToken) {
      accessToken = newToken;
      return retryFn();
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(error.error || 'Request failed', response.status);
  }
  return response.json();
}

export async function get<T>(url: string): Promise<T> {
  const makeRequest = async (): Promise<T> => {
    const response = await fetch(url, {
      method: 'GET',
      headers: await getAuthHeaders(),
      credentials: 'include',
    });
    return handleResponse<T>(response, makeRequest);
  };
  return makeRequest();
}

export async function post<T, B>(url: string, body: B): Promise<T> {
  const makeRequest = async (): Promise<T> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: await getAuthHeaders(true),
      credentials: 'include',
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response, makeRequest);
  };
  return makeRequest();
}

export async function put<T, B>(url: string, body: B): Promise<T> {
  const makeRequest = async (): Promise<T> => {
    const response = await fetch(url, {
      method: 'PUT',
      headers: await getAuthHeaders(true),
      credentials: 'include',
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response, makeRequest);
  };
  return makeRequest();
}

export async function del(url: string): Promise<void> {
  const makeRequest = async (): Promise<void> => {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: await getAuthHeaders(true),
      credentials: 'include',
    });
    if (response.status === 401 && refreshTokenFn) {
      const newToken = await refreshTokenFn();
      if (newToken) {
        accessToken = newToken;
        return makeRequest();
      }
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(error.error || 'Request failed', response.status);
    }
  };
  return makeRequest();
}
