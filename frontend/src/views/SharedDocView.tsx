import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RSVPDisplay } from '../components/RSVPDisplay';
import { getSharedDocument } from '../api/auth';
import { get } from '../api/client';
import { RSVPEngine } from '../engine/RSVPEngine';
import type { SharedDocument } from '../types/user';
import type { Token, Chunk } from '../types';

const TOKENS_PER_CHUNK = 5000;

function SharedDocView() {
  const { token: shareToken } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<SharedDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // RSVP state
  const [currentTokens, setCurrentTokens] = useState<Token[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const [position, setPosition] = useState(0);

  const engineRef = useRef<RSVPEngine | null>(null);
  const loadedChunksRef = useRef<Set<number>>(new Set());

  // Fetch document metadata
  useEffect(() => {
    if (!shareToken) return;

    const fetchDocument = async () => {
      try {
        const doc = await getSharedDocument(shareToken);
        setDocument(doc);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shared document');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [shareToken]);

  // Load chunk
  const loadChunk = useCallback(async (chunkIndex: number) => {
    if (!shareToken || !document || loadedChunksRef.current.has(chunkIndex)) return;

    try {
      const chunk = await get<Chunk>(`/api/shared/${shareToken}/tokens?chunk=${chunkIndex}`);
      loadedChunksRef.current.add(chunkIndex);

      if (engineRef.current) {
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
  }, [shareToken, document]);

  // Initialize engine
  useEffect(() => {
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

    return () => {
      engine.destroy();
    };
  }, [loadChunk]);

  // Load initial tokens when document is available
  useEffect(() => {
    if (document && shareToken && engineRef.current) {
      loadChunk(0);
    }
  }, [document, shareToken, loadChunk]);

  // Update WPM
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setConfig({ wpm });
    }
  }, [wpm]);

  const handlePlayPause = () => {
    engineRef.current?.toggle();
  };

  const handleSeek = (offset: number) => {
    if (!engineRef.current) return;
    engineRef.current.setPosition(position + offset);
  };

  const totalTokens = document?.tokenCount || 0;
  const progress = totalTokens > 0 ? (position / totalTokens) * 100 : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-vignette flex items-center justify-center">
        <div className="text-text-secondary font-rsvp text-xl italic">Loading...</div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-vignette flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🔗</div>
          <h1 className="text-2xl font-serif font-semibold text-text-primary mb-3">
            Document Not Found
          </h1>
          <p className="text-text-secondary mb-6">
            {error || 'This shared link may have expired or been revoked.'}
          </p>
          <Button onClick={() => navigate('/')}>
            Go to Speed Reader
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vignette flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-bg-base/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Speed Reader</span>
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <User className="w-4 h-4" />
            <span>Shared by {document.ownerName}</span>
          </div>
        </div>
      </header>

      {/* Title */}
      <div className="max-w-4xl mx-auto px-4 py-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl md:text-3xl font-serif font-semibold text-text-primary"
        >
          {document.title}
        </motion.h1>
      </div>

      {/* RSVP Display */}
      <div className="flex-1 flex items-center justify-center px-4">
        <RSVPDisplay tokens={currentTokens} />
      </div>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto w-full px-4 py-2">
        <div className="h-1 bg-bg-surface rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-amber-400"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-text-tertiary font-counter">
          <span>{position.toLocaleString()}</span>
          <span>{totalTokens.toLocaleString()} words</span>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-4xl mx-auto w-full px-4 py-6">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSeek(-10)}
            disabled={currentTokens.length === 0}
          >
            <SkipBack className="w-5 h-5" />
          </Button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handlePlayPause}
            disabled={currentTokens.length === 0}
            className="w-14 h-14 rounded-full bg-amber-400 text-bg-deep flex items-center justify-center shadow-lg shadow-amber-400/20 hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </motion.button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSeek(10)}
            disabled={currentTokens.length === 0}
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>

        {/* WPM Slider */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <span className="text-sm text-text-tertiary w-12">WPM</span>
          <Slider
            value={[wpm]}
            onValueChange={([v]) => setWpm(v)}
            min={100}
            max={1000}
            step={25}
            className="w-48"
          />
          <span className="text-sm font-counter text-amber-400 w-12">{wpm}</span>
        </div>
      </div>
    </div>
  );
}

export { SharedDocView };
export default SharedDocView;
