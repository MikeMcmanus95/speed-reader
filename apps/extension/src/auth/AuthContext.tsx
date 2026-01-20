import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { User } from '@speed-reader/types';

// Auth state stored in chrome.storage.local
interface StoredAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  user: User | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'auth_state';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const refreshInProgress = useRef(false);

  // Load auth state from storage on mount
  useEffect(() => {
    loadAuthState();
  }, []);

  // Listen for storage changes from service worker
  useEffect(() => {
    // Check if running in extension context
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
      return;
    }

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      namespace: string
    ) => {
      if (namespace !== 'local') return;
      if (changes[STORAGE_KEY]) {
        const newState = changes[STORAGE_KEY].newValue as StoredAuthState | null;
        if (newState) {
          setState({
            user: newState.user,
            accessToken: newState.accessToken,
            isLoading: false,
            isAuthenticated: !!newState.accessToken && !!newState.user,
          });
          setRefreshToken(newState.refreshToken);
          setExpiresAt(newState.expiresAt ? new Date(newState.expiresAt) : null);
        } else {
          setState({
            user: null,
            accessToken: null,
            isLoading: false,
            isAuthenticated: false,
          });
          setRefreshToken(null);
          setExpiresAt(null);
        }
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const loadAuthState = async () => {
    try {
      // Check if running in extension context
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        console.warn('Chrome storage not available - running outside extension context');
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const result = await chrome.storage.local.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY] as StoredAuthState | undefined;

      if (stored?.accessToken && stored?.user) {
        // Check if token is expired
        const tokenExpiresAt = stored.expiresAt ? new Date(stored.expiresAt) : null;
        const isExpired = tokenExpiresAt && tokenExpiresAt < new Date();

        if (isExpired && stored.refreshToken) {
          // Token expired, try to refresh
          const success = await refreshAuthInternal(stored.refreshToken);
          if (!success) {
            // Refresh failed, clear state
            await clearAuthState();
          }
        } else {
          // Token valid
          setState({
            user: stored.user,
            accessToken: stored.accessToken,
            isLoading: false,
            isAuthenticated: true,
          });
          setRefreshToken(stored.refreshToken);
          setExpiresAt(tokenExpiresAt);
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to load auth state:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const saveAuthState = async (authState: StoredAuthState) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: authState });
    }
  };

  const clearAuthState = async () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove(STORAGE_KEY);
    }
    setState({
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,
    });
    setRefreshToken(null);
    setExpiresAt(null);
  };

  const refreshAuthInternal = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/extension/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      await saveAuthState({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        user: data.user,
      });

      setState({
        user: data.user,
        accessToken: data.accessToken,
        isLoading: false,
        isAuthenticated: true,
      });
      setRefreshToken(data.refreshToken);
      setExpiresAt(new Date(data.expiresAt));

      return true;
    } catch (error) {
      console.error('Failed to refresh auth:', error);
      return false;
    }
  };

  const login = useCallback(async () => {
    try {
      // Check if running in extension context
      if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
        throw new Error(
          'Login requires running as a Chrome extension. Build the extension and load it in chrome://extensions'
        );
      }

      const extensionId = chrome.runtime.id;
      if (!extensionId) {
        throw new Error('Extension ID not available');
      }

      // Pre-flight check: verify backend is reachable
      try {
        const healthCheck = await fetch(`${BACKEND_URL}/api/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        if (!healthCheck.ok) {
          throw new Error(`Backend returned status ${healthCheck.status}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        throw new Error(
          `Cannot reach backend at ${BACKEND_URL}. Make sure the backend is running. (${message})`
        );
      }

      const authUrl = `${BACKEND_URL}/api/auth/extension/google?extension_id=${extensionId}`;

      // Use chrome.identity.launchWebAuthFlow for OAuth
      let redirectUrl: string | undefined;
      try {
        redirectUrl = await chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true,
        });
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.includes('canceled')) {
            throw new Error('Login cancelled by user');
          }
          if (err.message.includes('could not be loaded')) {
            throw new Error(
              `OAuth failed to load. Check that Google OAuth is configured in the backend ` +
                `(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL env vars). ` +
                `Original error: ${err.message}`
            );
          }
        }
        throw err;
      }

      if (!redirectUrl) {
        throw new Error('No redirect URL received');
      }

      // Parse tokens from URL fragment
      // Format: https://<extension_id>.chromiumapp.org/oauth2callback#access_token=xxx&refresh_token=yyy&expires_at=zzz&user_id=xxx
      const hashIndex = redirectUrl.indexOf('#');
      if (hashIndex === -1) {
        throw new Error('No hash fragment in redirect URL');
      }

      const hash = redirectUrl.substring(hashIndex + 1);
      const params = new URLSearchParams(hash);

      const accessToken = params.get('access_token');
      const newRefreshToken = params.get('refresh_token');
      const expiresAtStr = params.get('expires_at');

      if (!accessToken || !newRefreshToken) {
        throw new Error('Missing tokens in redirect URL');
      }

      // Fetch user info using the access token
      const userResponse = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      const user = await userResponse.json();

      // Save auth state
      await saveAuthState({
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: expiresAtStr,
        user,
      });

      setState({
        user,
        accessToken,
        isLoading: false,
        isAuthenticated: true,
      });
      setRefreshToken(newRefreshToken);
      setExpiresAt(expiresAtStr ? new Date(expiresAtStr) : null);

      // Notify that auth is complete (for sync to trigger)
      if (chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'AUTH_COMPLETED' });
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Call backend logout if we have a token
      if (state.accessToken) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${state.accessToken}` },
        }).catch(() => {
          // Ignore errors, we're logging out anyway
        });
      }
    } finally {
      await clearAuthState();
    }
  }, [state.accessToken]);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    if (!refreshToken) {
      return false;
    }
    return refreshAuthInternal(refreshToken);
  }, [refreshToken]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    // Check if token is expired or about to expire (within 1 minute)
    if (expiresAt) {
      const now = new Date();
      const expiresIn = expiresAt.getTime() - now.getTime();
      if (expiresIn < 60000) {
        // Prevent concurrent refresh calls
        if (refreshInProgress.current) {
          // Wait for ongoing refresh and return current token
          await new Promise(resolve => setTimeout(resolve, 100));
          return state.accessToken;
        }
        refreshInProgress.current = true;
        try {
          const success = await refreshAuth();
          if (!success) return null;
        } finally {
          refreshInProgress.current = false;
        }
      }
    }
    return state.accessToken;
  }, [state.accessToken, expiresAt, refreshAuth]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshAuth,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
