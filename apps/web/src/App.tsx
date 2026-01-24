import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster } from '@speed-reader/ui';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { DocumentStorageProvider } from './storage';
import { PasteInputView } from './views';

const ReaderView = lazy(() => import('./views/ReaderView'));
const LibraryView = lazy(() => import('./views/LibraryView'));
const SharedDocView = lazy(() => import('./views/SharedDocView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

function LoadingFallback() {
  return (
    <div className="flex flex-col min-h-screen bg-vignette items-center justify-center">
      <div className="text-text-secondary font-rsvp text-xl italic">Loading...</div>
    </div>
  );
}

function AuthCallback() {
  const navigate = useNavigate();
  const { isLoading, isAuthenticated } = useAuthContext();

  useEffect(() => {
    // Once auth is no longer loading, redirect to home
    if (!isLoading) {
      navigate('/', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  return <LoadingFallback />;
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <DocumentStorageProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<PasteInputView />} />
                <Route path="/library" element={<LibraryView />} />
                <Route path="/read/:id" element={<ReaderView />} />
                <Route path="/shared/:token" element={<SharedDocView />} />
                <Route path="/settings" element={<SettingsView />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
              </Routes>
            </Suspense>
            <Toaster position="top-right" />
          </BrowserRouter>
        </DocumentStorageProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
