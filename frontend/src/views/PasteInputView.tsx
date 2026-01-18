import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDocument } from '../api';
import './PasteInputView.css';

const MAX_SIZE = 1024 * 1024; // 1MB

export function PasteInputView() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contentSize = new Blob([content]).size;
  const isOverLimit = contentSize > MAX_SIZE;
  const sizeDisplay = contentSize > 1024
    ? `${(contentSize / 1024).toFixed(1)} KB`
    : `${contentSize} bytes`;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || isOverLimit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const doc = await createDocument({ title: title.trim(), content });
      navigate(`/read/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
      setIsSubmitting(false);
    }
  }, [title, content, isOverLimit, isSubmitting, navigate]);

  return (
    <div className="paste-input-view">
      <h1 className="paste-title">Speed Reader</h1>
      <p className="paste-subtitle">Paste your text below to start reading</p>

      <form className="paste-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="title-input"
          placeholder="Document title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isSubmitting}
          required
        />

        <div className="textarea-container">
          <textarea
            className={`content-textarea ${isOverLimit ? 'over-limit' : ''}`}
            placeholder="Paste your text here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSubmitting}
            required
          />
          <div className={`size-indicator ${isOverLimit ? 'over-limit' : ''}`}>
            {sizeDisplay} / 1 MB
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          type="submit"
          className="submit-button"
          disabled={!title.trim() || !content.trim() || isOverLimit || isSubmitting}
        >
          {isSubmitting ? 'Processing...' : 'Start Reading'}
        </button>
      </form>
    </div>
  );
}
