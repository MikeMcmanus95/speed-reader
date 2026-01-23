export { ApiError, get, post, put, del, setAccessToken, setRefreshTokenFn, setBaseUrl, getBaseUrl } from './client';
export * from './documents';
export * from './auth';
export { createWebAdapter } from './adapters/web';
export { createExtensionAdapter } from './adapters/extension';
export type { FetchAdapter } from './adapters/web';
