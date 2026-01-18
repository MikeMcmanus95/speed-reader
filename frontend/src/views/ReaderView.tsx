import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RSVPDisplay, ControlBar, ProgressBar } from '../components';
import { RSVPEngine, type RSVPConfig } from '../engine/RSVPEngine';
import { getDocument, getTokens, getReadingState, updateReadingState } from '../api';
import type { Document, Token } from '../types';
import './ReaderView.css';

const TOKENS_PER_CHUNK = 5000;
const SAVE_INTERVAL = 5000; // 5 seconds

export function ReaderView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<Document | null>(null);
  const [currentTokens, setCurrentTokens] = useState<Token[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [config, setConfig] = useState<RSVPConfig>({ wpm: 300, chunkSize: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<RSVPEngine | null>(null);
  const lastSaveRef = useRef<number>(0);
  const loadedChunksRef = useRef<Set<number>>(new Set());

  // Initialize engine
  useEffect(() => {
    const engine = new RSVPEngine({
      onTokenChange: (tokens) => setCurrentTokens(tokens),
      onStateChange: (playing) => setIsPlaying(playing),
      onPositionChange: (index) => setPosition(index),
      onNeedMoreTokens: (chunkIndex) => {
        if (id && !loadedChunksRef.current.has(chunkIndex)) {
          loadChunk(id, chunkIndex);
        }
      },
    });

    engineRef.current = engine;

    return () => {
      engine.destroy();
    };
  }, [id]);

  // Load chunk
  const loadChunk = useCallback(async (docId: string, chunkIndex: number) => {
    if (loadedChunksRef.current.has(chunkIndex)) return;

    try {
      const chunk = await getTokens(docId, chunkIndex);
      loadedChunksRef.current.add(chunkIndex);

      if (engineRef.current && document) {
        engineRef.current.setTokens(
          chunk.tokens,
          chunkIndex,
          document.tokenCount,
          TOKENS_PER_CHUNK
        );
      }
    } catch (err) {
      console.error(`Failed to load chunk ${chunkIndex}:`, err);
    }
  }, [document]);

  // Load document and initial state
  useEffect(() => {
    if (!id) {
      navigate('/');
      return;
    }

    async function loadDocument() {
      try {
        setLoading(true);
        setError(null);

        const [doc, state, chunk] = await Promise.all([
          getDocument(id!),
          getReadingState(id!),
          getTokens(id!, 0),
        ]);

        setDocument(doc);
        loadedChunksRef.current.add(0);

        if (engineRef.current) {
          engineRef.current.setTokens(chunk.tokens, 0, doc.tokenCount, TOKENS_PER_CHUNK);
          engineRef.current.setConfig({ wpm: state.wpm, chunkSize: state.chunkSize });
          setConfig({ wpm: state.wpm, chunkSize: state.chunkSize });

          // Load chunk containing saved position if needed
          const savedChunk = Math.floor(state.tokenIndex / TOKENS_PER_CHUNK);
          if (savedChunk > 0 && !loadedChunksRef.current.has(savedChunk)) {
            const savedChunkData = await getTokens(id!, savedChunk);
            loadedChunksRef.current.add(savedChunk);
            engineRef.current.setTokens(
              savedChunkData.tokens,
              savedChunk,
              doc.tokenCount,
              TOKENS_PER_CHUNK
            );
          }

          engineRef.current.setPosition(state.tokenIndex);
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
        setLoading(false);
      }
    }

    loadDocument();
  }, [id, navigate]);

  // Auto-save reading state
  useEffect(() => {
    const saveState = async () => {
      if (!id || Date.now() - lastSaveRef.current < SAVE_INTERVAL) return;

      try {
        await updateReadingState(id, {
          tokenIndex: position,
          wpm: config.wpm,
          chunkSize: config.chunkSize,
        });
        lastSaveRef.current = Date.now();
      } catch (err) {
        console.error('Failed to save reading state:', err);
      }
    };

    const interval = setInterval(saveState, SAVE_INTERVAL);

    // Save on unmount
    return () => {
      clearInterval(interval);
      if (id) {
        updateReadingState(id, {
          tokenIndex: position,
          wpm: config.wpm,
          chunkSize: config.chunkSize,
        }).catch(() => {});
      }
    };
  }, [id, position, config]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          engineRef.current?.toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          engineRef.current?.setPosition(position - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          engineRef.current?.setPosition(position + 10);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [position]);

  const handlePlayPause = useCallback(() => {
    engineRef.current?.toggle();
  }, []);

  const handleWpmChange = useCallback((wpm: number) => {
    setConfig((prev) => ({ ...prev, wpm }));
    engineRef.current?.setConfig({ wpm });
  }, []);

  const handleChunkSizeChange = useCallback((chunkSize: number) => {
    setConfig((prev) => ({ ...prev, chunkSize }));
    engineRef.current?.setConfig({ chunkSize });
  }, []);

  const handleSeek = useCallback((pos: number) => {
    engineRef.current?.setPosition(pos);
  }, []);

  if (loading) {
    return (
      <div className="reader-view">
        <div className="reader-loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reader-view">
        <div className="reader-error">
          <p>{error}</p>
          <button onClick={() => navigate('/')}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="reader-view">
      <header className="reader-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1 className="document-title">{document?.title}</h1>
      </header>

      <main className="reader-main">
        <RSVPDisplay tokens={currentTokens} />
      </main>

      <footer className="reader-footer">
        <ProgressBar
          current={position}
          total={document?.tokenCount || 0}
          onSeek={handleSeek}
        />
        <ControlBar
          isPlaying={isPlaying}
          wpm={config.wpm}
          chunkSize={config.chunkSize}
          onPlayPause={handlePlayPause}
          onWpmChange={handleWpmChange}
          onChunkSizeChange={handleChunkSizeChange}
        />
      </footer>
    </div>
  );
}
