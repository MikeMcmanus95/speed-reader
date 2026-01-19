import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { PasteInputView } from './views';

const ReaderView = lazy(() => import('./views/ReaderView'));
const LibraryView = lazy(() => import('./views/LibraryView'));
const SharedDocView = lazy(() => import('./views/SharedDocView'));

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
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<PasteInputView />} />
            <Route path="/library" element={<LibraryView />} />
            <Route path="/read/:id" element={<ReaderView />} />
            <Route path="/shared/:token" element={<SharedDocView />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
