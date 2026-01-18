import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PasteInputView } from './views';

const ReaderView = lazy(() => import('./views/ReaderView'));
const LibraryView = lazy(() => import('./views/LibraryView'));

function LoadingFallback() {
  return (
    <div className="flex flex-col min-h-screen bg-vignette items-center justify-center">
      <div className="text-text-secondary font-rsvp text-xl italic">Loading...</div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<PasteInputView />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/read/:id" element={<ReaderView />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
