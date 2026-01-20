import { useState, useEffect, useCallback } from 'react';
import { HomeView } from './views/HomeView';
import { ReaderView } from './views/ReaderView';
import { LibraryView } from './views/LibraryView';

type View = 'home' | 'reader' | 'library';

// Configuration for polling mechanism
const POLL_INTERVAL_MS = 100;
const MAX_POLL_DURATION_MS = 3000;
const STALENESS_THRESHOLD_MS = 5000;

export function App() {
  const [view, setView] = useState<View>('home');
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);

  // Robust polling mechanism for pending documents
  // This handles timing issues where:
  // 1. Sidepanel opens before service worker sets the pending document
  // 2. Storage listener isn't attached yet when document is created
  // 3. Multiple browser windows race to consume the pending document
  useEffect(() => {
    let isMounted = true;
    let isProcessing = false; // Prevent concurrent consumption attempts
    let pollCount = 0;
    const maxPolls = MAX_POLL_DURATION_MS / POLL_INTERVAL_MS;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const consumePendingDocument = async () => {
      if (!isMounted || isProcessing) return;
      isProcessing = true;

      try {
        const result = await chrome.storage.local.get([
          'pendingDocument',
          'autoPlay',
          'pendingDocumentTimestamp',
        ]);

        if (!result.pendingDocument) {
          // No pending document, continue polling
          isProcessing = false;
          pollCount++;
          if (pollCount >= maxPolls && intervalId) {
            clearInterval(intervalId);
          }
          return;
        }

        // Check staleness - ignore documents older than threshold
        const timestamp = result.pendingDocumentTimestamp || 0;
        const age = Date.now() - timestamp;

        if (age > STALENESS_THRESHOLD_MS) {
          console.log(`Ignoring stale pending document (age: ${age}ms)`);
          await chrome.storage.local.remove([
            'pendingDocument',
            'autoPlay',
            'pendingDocumentTimestamp',
          ]);
          isProcessing = false;
          return;
        }

        // Atomically consume: clear storage immediately to prevent other windows from consuming
        await chrome.storage.local.remove([
          'pendingDocument',
          'autoPlay',
          'pendingDocumentTimestamp',
        ]);

        // Stop polling - we found the document
        if (intervalId) {
          clearInterval(intervalId);
        }

        // Navigate to reader with the document
        console.log(`Found pending document: ${result.pendingDocument} (autoPlay: ${result.autoPlay})`);
        setCurrentDocId(result.pendingDocument);
        setAutoPlay(result.autoPlay || false);
        setView('reader');
      } catch (error) {
        console.error('Error polling for pending document:', error);
        isProcessing = false;
      }
    };

    // Initial check immediately on mount
    consumePendingDocument();

    // Then poll at regular intervals
    intervalId = setInterval(consumePendingDocument, POLL_INTERVAL_MS);

    // Also listen for storage changes (handles documents created while sidepanel is open)
    const storageListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      namespace: string
    ) => {
      if (namespace !== 'local') return;
      if (changes.pendingDocument?.newValue) {
        // Document was just created, poll will pick it up
        consumePendingDocument();
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
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
