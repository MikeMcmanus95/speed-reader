import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2 } from 'lucide-react';
import { RSVPDisplay, ControlBar, ProgressBar, Button, useReadingTimer } from '@speed-reader/ui';
import { RSVPEngine, type RSVPConfig } from '@speed-reader/engine';
import type { Document, Token } from '@speed-reader/types';
import { UserMenu } from '../components/UserMenu';
import { ShareModal } from '../components/ShareModal';
import { useDocumentStorage, useIsLocalStorage } from '../storage';

const TOKENS_PER_CHUNK = 5000;
const SAVE_INTERVAL = 5000; // 5 seconds

function ReaderView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const storage = useDocumentStorage();
  const isLocalStorage = useIsLocalStorage();
  const storageRef = useRef(storage);
  storageRef.current = storage;

  const [document, setDocument] = useState<Document | null>(null);
  const [currentTokens, setCurrentTokens] = useState<Token[]>([]);
  const [loadedTokens, setLoadedTokens] = useState<Token[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [config, setConfig] = useState<RSVPConfig>({ wpm: 300, chunkSize: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const engineRef = useRef<RSVPEngine | null>(null);
  const loadedChunksRef = useRef<Set<number>>(new Set());
  const positionRef = useRef(position);
  const configRef = useRef(config);
  const hasLoadedReadingStateRef = useRef(false);

  const { elapsedFormatted, totalFormatted } = useReadingTimer({
    tokens: loadedTokens,
    currentIndex: position,
    totalTokens: document?.tokenCount || 0,
    wpm: config.wpm,
  });

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
      const chunk = await storageRef.current.getTokens(docId, chunkIndex);
      loadedChunksRef.current.add(chunkIndex);

      if (engineRef.current && document) {
        engineRef.current.setTokens(
          chunk.tokens,
          chunkIndex,
          document.tokenCount,
          TOKENS_PER_CHUNK
        );
        setLoadedTokens(engineRef.current.getAllLoadedTokens());
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
          storageRef.current.getDocument(id!),
          storageRef.current.getReadingState(id!),
          storageRef.current.getTokens(id!, 0),
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
            const savedChunkData = await storageRef.current.getTokens(id!, savedChunk);
            loadedChunksRef.current.add(savedChunk);
            engineRef.current.setTokens(
              savedChunkData.tokens,
              savedChunk,
              doc.tokenCount,
              TOKENS_PER_CHUNK
            );
          }

          setLoadedTokens(engineRef.current.getAllLoadedTokens());
          engineRef.current.setPosition(state.tokenIndex);
          hasLoadedReadingStateRef.current = true;
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
    const saveState = () => {
      // Don't save if we haven't loaded the reading state yet
      // This prevents overwriting saved progress with position 0 if user navigates away before load completes
      if (!id || !hasLoadedReadingStateRef.current) return;
      storageRef.current.updateReadingState(id, {
        tokenIndex: positionRef.current,
        wpm: configRef.current.wpm,
        chunkSize: configRef.current.chunkSize,
      }).catch((err) => {
        console.error('Failed to save reading state:', err);
      });
    };

    // Periodic save every 5 seconds
    const interval = setInterval(saveState, SAVE_INTERVAL);

    // Save on browser close/refresh
    const handleBeforeUnload = () => saveState();
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup: save on unmount and remove listeners
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveState();
    };
  }, [id]); // Only depends on id - NOT position or config

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

  // Keep refs in sync with state
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { configRef.current = config; }, [config]);

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
      <div className="flex flex-col min-h-screen bg-vignette">
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-text-secondary font-rsvp text-xl italic">
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-vignette">
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <p className="text-destructive text-lg">{error}</p>
          <Button onClick={() => navigate('/')}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-vignette">
      <header className="flex items-center gap-4 px-4 md:px-8 py-4 bg-bg-elevated/80 backdrop-blur-sm border-b border-border-subtle">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/library')}
          className="gap-2 text-text-secondary hover:text-amber-400 hover:bg-bg-surface"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="flex-1 text-lg md:text-xl font-semibold text-text-primary truncate">
          {document?.title}
        </h1>
        {!isLocalStorage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsShareModalOpen(true)}
            className="gap-2 text-text-secondary hover:text-amber-400 hover:bg-bg-surface"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        )}
        <UserMenu />
      </header>

      {document && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          documentId={document.id}
          documentTitle={document.title}
        />
      )}

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <RSVPDisplay tokens={currentTokens} />
      </main>

      <footer className="flex flex-col gap-4 p-4 md:px-8 md:py-6 bg-bg-elevated/80 backdrop-blur-sm border-t border-border-subtle">
        <ProgressBar
          current={position}
          total={document?.tokenCount || 0}
          onSeek={handleSeek}
          elapsedTime={elapsedFormatted}
          totalTime={totalFormatted}
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

export { ReaderView };
export default ReaderView;
