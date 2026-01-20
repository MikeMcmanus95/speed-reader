import { useState, useEffect, useCallback } from 'react';
import { HomeView } from './views/HomeView';
import { ReaderView } from './views/ReaderView';
import { LibraryView } from './views/LibraryView';

type View = 'home' | 'reader' | 'library';

export function App() {
  const [view, setView] = useState<View>('home');
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);

  // Listen for new documents from background script
  useEffect(() => {
    const checkPendingDocument = async () => {
      const result = await chrome.storage.local.get(['pendingDocument', 'autoPlay']);
      if (result.pendingDocument) {
        setCurrentDocId(result.pendingDocument);
        setAutoPlay(result.autoPlay || false);
        setView('reader');
        await chrome.storage.local.remove(['pendingDocument', 'autoPlay']);
      }
    };

    checkPendingDocument();

    // Listen for storage changes
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.pendingDocument?.newValue) {
        setCurrentDocId(changes.pendingDocument.newValue);
        // Read autoPlay from changes object directly (avoids race condition)
        setAutoPlay(changes.autoPlay?.newValue || false);
        setView('reader');
        chrome.storage.local.remove(['pendingDocument', 'autoPlay']);
      }
    };

    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
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
