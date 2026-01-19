import { useAuthContext } from '../contexts/AuthContext';

export function useAuth() {
  return useAuthContext();
}

export function useUser() {
  const { user } = useAuthContext();
  return user;
}

export function useIsAuthenticated() {
  const { isAuthenticated, isLoading } = useAuthContext();
  return { isAuthenticated, isLoading };
}

export function useAccessToken() {
  const { getAccessToken } = useAuthContext();
  return getAccessToken;
}
