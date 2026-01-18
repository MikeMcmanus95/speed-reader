import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PasteInputView, ReaderView } from './views';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PasteInputView />} />
        <Route path="/read/:id" element={<ReaderView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
