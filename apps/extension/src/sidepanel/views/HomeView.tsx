import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Library } from 'lucide-react';
import { Button, Textarea } from '@speed-reader/ui';
import { tokenize, chunkTokens } from '@speed-reader/tokenizer';
import { saveDocument, saveChunks, type LocalDocument } from '../../storage/db';
import { useAuth } from '../../auth/AuthContext';
import { getSyncManager } from '../../sync/SyncManager';

interface HomeViewProps {
  onNavigate: (view: 'home' | 'reader' | 'library', docId?: string) => void;
}

export function HomeView({ onNavigate }: HomeViewProps) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleSubmit = async () => {
    if (!text.trim()) return;

    setIsProcessing(true);
    try {
      // Tokenize
      const tokens = tokenize(text);
      const chunks = chunkTokens(tokens);

      // Create document
      const docId = crypto.randomUUID();
      const now = Date.now();

      const doc: LocalDocument = {
        id: docId,
        title: title.trim() || extractTitle(text),
        source: 'manual',
        content: text, // Store raw content for syncing
        createdAt: now,
        updatedAt: now,
        tokenCount: tokens.length,
        chunkCount: chunks.length,
        // Mark as pending if authenticated (will sync), local otherwise
        syncStatus: isAuthenticated ? 'pending' : 'local',
        lastSyncedAt: null,
      };

      await saveDocument(doc);
      await saveChunks(docId, chunks);

      // Trigger sync if authenticated
      if (isAuthenticated) {
        try {
          getSyncManager().syncDocument(docId).catch(console.error);
        } catch {
          // SyncManager not initialized yet
        }
      }

      onNavigate('reader', docId);
    } catch (error) {
      console.error('Failed to create document:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-4">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          Speed Reader
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate('library')}
          className="gap-2"
        >
          <Library className="w-4 h-4" />
          Library
        </Button>
      </motion.header>

      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 flex flex-col gap-4"
      >
        <div className="space-y-2">
          <label className="text-sm text-text-secondary">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title..."
            className="w-full px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
        </div>

        <div className="flex-1 flex flex-col space-y-2">
          <label className="text-sm text-text-secondary">
            Paste text to speed read
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here, or use the right-click menu to speed read selected text from any webpage..."
            className="flex-1 min-h-[200px] resize-none"
          />
        </div>

        <div className="flex items-center justify-between text-sm text-text-tertiary">
          <span>{text.length.toLocaleString()} characters</span>
          <span>{text.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!text.trim() || isProcessing}
          className="w-full"
        >
          {isProcessing ? 'Processing...' : 'Start Reading'}
        </Button>
      </motion.main>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-4 text-center text-xs text-text-tertiary"
      >
        Tip: Highlight text on any webpage and right-click → "Speed Read Selection"
      </motion.footer>
    </div>
  );
}

function extractTitle(text: string): string {
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length <= 50) return firstLine;
  return firstLine.substring(0, 47) + '...';
}
