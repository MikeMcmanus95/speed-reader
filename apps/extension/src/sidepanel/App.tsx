import { useState, useEffect, useCallback } from 'react';
import { HomeView } from './views/HomeView';
import { ReaderView } from './views/ReaderView';
import { LibraryView } from './views/LibraryView';
import { AuthProvider, useAuth } from '../auth/AuthContext';
import { initializeApiClient } from '../api/client';
import { initializeSyncManager, getSyncManager } from '../sync/SyncManager';

type View = 'home' | 'reader' | 'library';

// Initialize sync after auth is ready
function SyncInitializer() {
  const { getAccessToken, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // Initialize API client with auth context's getAccessToken
    const apiClient = initializeApiClient(getAccessToken);
    initializeSyncManager(apiClient);

    // If authenticated, trigger initial sync
    if (isAuthenticated) {
      getSyncManager().syncAll().catch(console.error);
    }
  }, [getAccessToken, isAuthenticated, isLoading]);

  // Listen for auth completion message from login
  useEffect(() => {
    const listener = (message: { type: string }) => {
      if (message.type === 'AUTH_COMPLETED') {
        try {
          getSyncManager().syncAll().catch(console.error);
        } catch {
          // SyncManager not initialized yet
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return null;
}

function AppContent() {
  const [view, setView] = useState<View>('home');
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);

  // Listen for new documents from background script
  useEffect(() => {
    let cancelled = false;

    const handlePendingDocument = (pending: { docId: string; autoPlay: boolean }) => {
      if (cancelled) return;
      setCurrentDocId(pending.docId);
      setAutoPlay(pending.autoPlay || false);
      setView('reader');
      chrome.storage.local.remove('pendingDocument');
    };

    // Poll for pending document (handles race condition where document
    // is created after sidepanel opens but before listener is ready)
    const pollForPendingDocument = async () => {
      const maxAttempts = 10;
      const interval = 200; // ms

      for (let i = 0; i < maxAttempts && !cancelled; i++) {
        const result = await chrome.storage.local.get('pendingDocument');
        if (result.pendingDocument) {
          handlePendingDocument(result.pendingDocument);
          return;
        }
        if (i < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      }
    };

    pollForPendingDocument();

    // Also listen for storage changes for documents created later
    const storageListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      namespace: string
    ) => {
      if (namespace !== 'local') return;
      if (changes.pendingDocument?.newValue) {
        handlePendingDocument(changes.pendingDocument.newValue);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  const handleNavigate = (newView: View, docId?: string) => {
    if (docId) setCurrentDocId(docId);
    setAutoPlay(false); // Reset autoPlay when navigating manually
    setView(newView);
  };

  // Clear autoPlay after reader view has consumed it
  const handleAutoPlayConsumed = useCallback(() => {
    setAutoPlay(false);
  }, []);

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {view === 'home' && (
        <HomeView onNavigate={handleNavigate} />
      )}
      {view === 'reader' && currentDocId && (
        <ReaderView
          docId={currentDocId}
          onBack={() => setView('library')}
          autoPlay={autoPlay}
          onAutoPlayConsumed={handleAutoPlayConsumed}
        />
      )}
      {view === 'library' && (
        <LibraryView
          onSelect={(docId) => handleNavigate('reader', docId)}
          onBack={() => setView('home')}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <SyncInitializer />
      <AppContent />
    </AuthProvider>
  );
}
