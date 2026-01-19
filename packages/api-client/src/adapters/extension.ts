import type { FetchAdapter } from './web';

export function createExtensionAdapter(backendUrl: string): FetchAdapter {
  return {
    fetch: async (url: string, init?: RequestInit) => {
      let token: string | undefined;
      try {
        const authResult = await chrome.identity.getAuthToken({ interactive: false });
        token = authResult.token;
      } catch {
        // No token available
      }

      const headers = new Headers(init?.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      headers.set('Content-Type', 'application/json');

      return fetch(`${backendUrl}${url}`, {
        ...init,
        headers,
      });
    },
  };
}
