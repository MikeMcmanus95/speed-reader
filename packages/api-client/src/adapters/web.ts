export interface FetchAdapter {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export function createWebAdapter(baseUrl: string = '/api'): FetchAdapter {
  return {
    fetch: (url: string, init?: RequestInit) =>
      fetch(`${baseUrl}${url}`, {
        ...init,
        credentials: 'include',
      }),
  };
}
