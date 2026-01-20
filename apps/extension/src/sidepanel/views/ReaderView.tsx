import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ProgressBar, Button } from '@speed-reader/ui';
import { RSVPEngine, type RSVPConfig } from '@speed-reader/engine';
import type { Token } from '@speed-reader/types';
import {
  getDocument,
  getChunk,
  getReadingState,
  saveReadingState,
  type LocalDocument,
} from '../../storage/db';
import { CompactControlBar } from '../components/CompactControlBar';
import { ExtensionRSVPDisplay } from '../components/ExtensionRSVPDisplay';

interface ReaderViewProps {
  docId: string;
  onBack: () => void;
  autoPlay?: boolean;
  onAutoPlayConsumed?: () => void;
}

const TOKENS_PER_CHUNK = 5000;
const SAVE_INTERVAL = 5000;

export function ReaderView({ docId, onBack, autoPlay, onAutoPlayConsumed }: ReaderViewProps) {
  const [document, setDocument] = useState<LocalDocument | null>(null);
  const [currentTokens, setCurrentTokens] = useState<Token[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [config, setConfig] = useState<RSVPConfig>({ wpm: 300, chunkSize: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<RSVPEngine | null>(null);
  const loadedChunksRef = useRef<Set<number>>(new Set());
  const positionRef = useRef(position);
  const configRef = useRef(config);
  const hasLoadedStateRef = useRef(false);
  const hasAutoPlayedRef = useRef(false);

  // Initialize engine
  useEffect(() => {
    // Reset autoPlay guard when document changes
    hasAutoPlayedRef.current = false;

    const engine = new RSVPEngine({
      onTokenChange: (tokens) => setCurrentTokens(tokens),
      onStateChange: (playing) => setIsPlaying(playing),
      onPositionChange: (index) => setPosition(index),
      onNeedMoreTokens: (chunkIndex) => {
        if (!loadedChunksRef.current.has(chunkIndex)) {
          loadChunk(chunkIndex);
        }
      },
    });

    engineRef.current = engine;
    return () => engine.destroy();
  }, [docId]);

  // Load document and initial state
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const doc = await getDocument(docId);
        if (!doc) {
          setError('Document not found');
          setLoading(false);
          return;
        }
        setDocument(doc);

        // Load reading state
        const state = await getReadingState(docId);
        if (state) {
          setConfig({ wpm: state.wpm, chunkSize: state.chunkSize });
          engineRef.current?.setConfig({ wpm: state.wpm, chunkSize: state.chunkSize });
        }

        // Load first chunk
        const chunk0 = await getChunk(docId, 0);
        if (chunk0) {
          loadedChunksRef.current.add(0);
          engineRef.current?.setTokens(chunk0.tokens, 0, doc.tokenCount, TOKENS_PER_CHUNK);
        }

        // If saved position is in a different chunk, load that too
        if (state && state.tokenIndex >= TOKENS_PER_CHUNK) {
          const savedChunkIndex = Math.floor(state.tokenIndex / TOKENS_PER_CHUNK);
          if (!loadedChunksRef.current.has(savedChunkIndex)) {
            const savedChunk = await getChunk(docId, savedChunkIndex);
            if (savedChunk) {
              loadedChunksRef.current.add(savedChunkIndex);
              engineRef.current?.setTokens(
                savedChunk.tokens,
                savedChunkIndex,
                doc.tokenCount,
                TOKENS_PER_CHUNK
              );
            }
          }
        }

        // Set position after chunks are loaded
        if (state) {
          engineRef.current?.setPosition(state.tokenIndex);
        }

        hasLoadedStateRef.current = true;
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
        setLoading(false);
      }
    }

    load();
  }, [docId]);

  // Load chunk
  const loadChunk = useCallback(async (chunkIndex: number) => {
    if (loadedChunksRef.current.has(chunkIndex)) return;

    try {
      const chunk = await getChunk(docId, chunkIndex);
      if (chunk && document) {
        loadedChunksRef.current.add(chunkIndex);
        engineRef.current?.setTokens(
          chunk.tokens,
          chunkIndex,
          document.tokenCount,
          TOKENS_PER_CHUNK
        );
      }
    } catch (err) {
      console.error(`Failed to load chunk ${chunkIndex}:`, err);
    }
  }, [docId, document]);

  // Auto-save reading state
  useEffect(() => {
    const save = () => {
      if (!hasLoadedStateRef.current) return;
      saveReadingState({
        docId,
        tokenIndex: positionRef.current,
        wpm: configRef.current.wpm,
        chunkSize: configRef.current.chunkSize,
        updatedAt: Date.now(),
        lastSyncedAt: null,
      }).catch(console.error);
    };

    const interval = setInterval(save, SAVE_INTERVAL);
    return () => {
      clearInterval(interval);
      save(); // Final save on unmount
    };
  }, [docId]);

  // Keep refs in sync
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { configRef.current = config; }, [config]);

  // Auto-play when triggered from context menu or keyboard shortcut
  useEffect(() => {
    if (!loading && autoPlay && engineRef.current && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        engineRef.current?.play();
        onAutoPlayConsumed?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, autoPlay, onAutoPlayConsumed]);

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
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text-secondary font-rsvp italic">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-vignette">
      <header className="flex items-center gap-2 px-3 py-2 bg-bg-elevated/80 backdrop-blur-sm border-b border-border-subtle">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="flex-1 text-sm font-medium truncate">
          {document?.title}
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <ExtensionRSVPDisplay tokens={currentTokens} />
      </main>

      <footer className="flex flex-col gap-2 p-2 bg-bg-elevated/80 backdrop-blur-sm border-t border-border-subtle">
        <ProgressBar
          current={position}
          total={document?.tokenCount || 0}
          onSeek={handleSeek}
        />
        <CompactControlBar
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
