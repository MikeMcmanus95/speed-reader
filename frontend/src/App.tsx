import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PasteInputView, ReaderView, LibraryView } from './views';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PasteInputView />} />
        <Route path="/library" element={<LibraryView />} />
        <Route path="/read/:id" element={<ReaderView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
