import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import type { IDocumentStorage } from './interfaces/IDocumentStorage';
import { LocalDocumentStorage } from './local';
import { RemoteDocumentStorage } from './remote';

const DocumentStorageContext = createContext<IDocumentStorage | null>(null);

interface DocumentStorageProviderProps {
  children: ReactNode;
}

/**
 * Provides the appropriate document storage implementation based on auth state.
 * - Authenticated users: RemoteDocumentStorage (backend API)
 * - Unauthenticated users: LocalDocumentStorage (IndexedDB)
 */
export function DocumentStorageProvider({ children }: DocumentStorageProviderProps) {
  const { user, isLoading } = useAuthContext();

  const storage = useMemo<IDocumentStorage>(() => {
    // While loading auth state, default to local storage
    // (will switch to remote if user is authenticated)
    if (isLoading) {
      return new LocalDocumentStorage();
    }

    // Use remote storage for authenticated users
    if (user !== null) {
      return new RemoteDocumentStorage();
    }

    // Use local storage for unauthenticated users
    return new LocalDocumentStorage();
  }, [user, isLoading]);

  return (
    <DocumentStorageContext.Provider value={storage}>
      {children}
    </DocumentStorageContext.Provider>
  );
}

/**
 * Hook to access the document storage service.
 * Returns the appropriate storage implementation based on auth state.
 */
export function useDocumentStorage(): IDocumentStorage {
  const context = useContext(DocumentStorageContext);
  if (!context) {
    throw new Error('useDocumentStorage must be used within a DocumentStorageProvider');
  }
  return context;
}

/**
 * Check if we're using local storage (for migration UI purposes).
 */
export function useIsLocalStorage(): boolean {
  const { user, isLoading } = useAuthContext();
  return isLoading || user === null;
}
