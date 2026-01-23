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
import {
  refreshToken as refreshTokenApi,
  logout as logoutApi,
  getGoogleAuthUrl,
  setAccessToken,
  setRefreshTokenFn,
} from '@speed-reader/api-client';
import { MigrationService } from '../storage/MigrationService';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isMigrating: boolean;
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
    isMigrating: false,
  });

  const [tokenExpiresAt, setTokenExpiresAt] = useState<Date | null>(null);
  const migrationServiceRef = useRef<MigrationService | null>(null);

  // Get or create migration service
  const getMigrationService = useCallback(() => {
    if (!migrationServiceRef.current) {
      migrationServiceRef.current = new MigrationService();
    }
    return migrationServiceRef.current;
  }, []);

  // Sync access token with API client
  useEffect(() => {
    setAccessToken(state.accessToken);
  }, [state.accessToken]);

  // Set up refresh token function in API client
  useEffect(() => {
    setRefreshTokenFn(async () => {
      try {
        const response = await refreshTokenApi();
        setState(prev => ({
          ...prev,
          user: response.user,
          accessToken: response.accessToken,
          isLoading: false,
          isAuthenticated: true,
        }));
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
      // Normal initialization - try to refresh existing session
      initializeAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        isMigrating: false,
      });
      setTokenExpiresAt(new Date(response.expiresAt));
    } catch {
      // No valid session - user is unauthenticated
      // Documents will be stored locally in IndexedDB
      setState({
        user: null,
        accessToken: null,
        isLoading: false,
        isAuthenticated: false,
        isMigrating: false,
      });
    }
  };

  const handleOAuthCallback = async (_token: string) => {
    // The token from OAuth callback - we use refresh to get the full user info
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const response = await refreshTokenApi();

      // Check if there are local documents to migrate
      const migrationService = getMigrationService();
      const hasLocalDocs = await migrationService.hasLocalDocuments();

      if (hasLocalDocs) {
        setState(prev => ({
          ...prev,
          user: response.user,
          accessToken: response.accessToken,
          isLoading: false,
          isAuthenticated: true,
          isMigrating: true,
        }));
        setTokenExpiresAt(new Date(response.expiresAt));

        // Migrate local documents to the user's account
        try {
          const result = await migrationService.migrateLocalDocuments(response.user.id);
          if (result.failedDocuments.length > 0) {
            console.warn('Some documents failed to migrate:', result.failedDocuments);
          }
        } catch (err) {
          console.error('Migration failed:', err);
        }

        setState(prev => ({ ...prev, isMigrating: false }));
      } else {
        setState({
          user: response.user,
          accessToken: response.accessToken,
          isLoading: false,
          isAuthenticated: true,
          isMigrating: false,
        });
        setTokenExpiresAt(new Date(response.expiresAt));
      }
    } catch (error) {
      console.error('OAuth callback failed:', error);
      setState(prev => ({ ...prev, isLoading: false, isMigrating: false }));
    }
  };

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await refreshTokenApi();
      setState(prev => ({
        ...prev,
        user: response.user,
        accessToken: response.accessToken,
        isLoading: false,
        isAuthenticated: true,
      }));
      setTokenExpiresAt(new Date(response.expiresAt));
      return true;
    } catch {
      // If refresh fails, user becomes unauthenticated
      setState(prev => ({
        ...prev,
        user: null,
        accessToken: null,
        isLoading: false,
        isAuthenticated: false,
      }));
      return false;
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
    // No guest ID needed - we migrate local documents after OAuth callback
    window.location.href = getGoogleAuthUrl();
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.error('Logout error:', error);
    }
    // After logout, user becomes unauthenticated
    // Documents will be stored locally in IndexedDB
    setState({
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,
      isMigrating: false,
    });
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
