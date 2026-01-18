import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '../types/user';
import {
  createGuestUser,
  refreshToken as refreshTokenApi,
  logout as logoutApi,
  getGoogleAuthUrl,
} from '../api/auth';
import { setAccessToken, setRefreshTokenFn } from '../api/client';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: () => void;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

  const [tokenExpiresAt, setTokenExpiresAt] = useState<Date | null>(null);

  // Sync access token with API client
  useEffect(() => {
    setAccessToken(state.accessToken);
  }, [state.accessToken]);

  // Set up refresh token function in API client
  useEffect(() => {
    setRefreshTokenFn(async () => {
      try {
        const response = await refreshTokenApi();
        setState({
          user: response.user,
          accessToken: response.accessToken,
          isLoading: false,
          isAuthenticated: true,
        });
        setTokenExpiresAt(new Date(response.expiresAt));
        return response.accessToken;
      } catch {
        return null;
      }
    });
  }, []);

  // Initialize auth on mount
  useEffect(() => {
    // Check if this is an OAuth callback - if so, let handleOAuthCallback handle it
    const hash = window.location.hash;
    if (hash.startsWith('#token=')) {
      const token = hash.substring(7);
      // Clear the hash from URL
      window.history.replaceState(null, '', window.location.pathname);
      // Handle OAuth callback
      handleOAuthCallback(token);
    } else {
      // Normal initialization - try to refresh or create guest
      initializeAuth();
    }
  }, []);

  const initializeAuth = async () => {
    try {
      // Try to refresh existing session
      const response = await refreshTokenApi();
      setState({
        user: response.user,
        accessToken: response.accessToken,
        isLoading: false,
        isAuthenticated: true,
      });
      setTokenExpiresAt(new Date(response.expiresAt));
    } catch {
      // No valid session, create guest user
      try {
        const response = await createGuestUser();
        setState({
          user: response.user,
          accessToken: response.accessToken,
          isLoading: false,
          isAuthenticated: true,
        });
        setTokenExpiresAt(new Date(response.expiresAt));
      } catch (guestError) {
        console.error('Failed to create guest user:', guestError);
        setState({
          user: null,
          accessToken: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    }
  };

  const handleOAuthCallback = async (_token: string) => {
    // The token from OAuth callback - we use refresh to get the full user info
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const response = await refreshTokenApi();
      setState({
        user: response.user,
        accessToken: response.accessToken,
        isLoading: false,
        isAuthenticated: true,
      });
      setTokenExpiresAt(new Date(response.expiresAt));
    } catch (error) {
      console.error('OAuth callback failed:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await refreshTokenApi();
      setState({
        user: response.user,
        accessToken: response.accessToken,
        isLoading: false,
        isAuthenticated: true,
      });
      setTokenExpiresAt(new Date(response.expiresAt));
      return true;
    } catch {
      // If refresh fails, create a new guest user
      try {
        const response = await createGuestUser();
        setState({
          user: response.user,
          accessToken: response.accessToken,
          isLoading: false,
          isAuthenticated: true,
        });
        setTokenExpiresAt(new Date(response.expiresAt));
        return true;
      } catch {
        setState({
          user: null,
          accessToken: null,
          isLoading: false,
          isAuthenticated: false,
        });
        return false;
      }
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    // Check if token is expired or about to expire (within 1 minute)
    if (tokenExpiresAt) {
      const now = new Date();
      const expiresIn = tokenExpiresAt.getTime() - now.getTime();
      if (expiresIn < 60000) {
        // Token expired or expiring soon, refresh
        const success = await refreshAuth();
        if (!success) return null;
      }
    }
    return state.accessToken;
  }, [state.accessToken, tokenExpiresAt, refreshAuth]);

  const login = useCallback(() => {
    // Redirect to Google OAuth
    window.location.href = getGoogleAuthUrl();
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.error('Logout error:', error);
    }
    // Create a new guest user after logout
    try {
      const response = await createGuestUser();
      setState({
        user: response.user,
        accessToken: response.accessToken,
        isLoading: false,
        isAuthenticated: true,
      });
      setTokenExpiresAt(new Date(response.expiresAt));
    } catch {
      setState({
        user: null,
        accessToken: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshAuth,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
