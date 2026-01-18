import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Pencil, Trash2, Check, X, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DocumentWithProgress } from '../types';

interface DocumentCardProps {
  document: DocumentWithProgress;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  animationDelay?: number;
}

export const DocumentCard = React.memo(function DocumentCard({ document, onRename, onDelete, animationDelay = 0 }: DocumentCardProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editTitle, setEditTitle] = useState(document.title);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const progress = document.tokenCount > 0
    ? (document.tokenIndex / document.tokenCount) * 100
    : 0;

  const isCompleted = progress >= 99;
  const hasStarted = document.tokenIndex > 0;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveRename = async () => {
    if (!editTitle.trim() || editTitle === document.title) {
      setIsEditing(false);
      setEditTitle(document.title);
      return;
    }

    setIsLoading(true);
    try {
      await onRename(document.id, editTitle.trim());
      setIsEditing(false);
    } catch {
      setEditTitle(document.title);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRename = () => {
    setEditTitle(document.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  const handleConfirmDelete = async () => {
    setIsLoading(true);
    try {
      await onDelete(document.id);
    } finally {
      setIsLoading(false);
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: animationDelay, ease: 'easeOut' }}
      className="relative group"
    >
      <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden hover:border-amber-500/30 transition-colors">
        <AnimatePresence mode="wait">
          {isDeleting ? (
            <motion.div
              key="delete-confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-5 flex flex-col items-center justify-center min-h-[180px] gap-4"
            >
              <p className="text-text-secondary text-sm text-center">
                Delete "{document.title}"?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleting(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmDelete}
                  disabled={isLoading}
                >
                  {isLoading ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="card-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        ref={inputRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        className="h-8 text-base"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleSaveRename}
                        disabled={isLoading}
                        className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleCancelRename}
                        disabled={isLoading}
                        className="h-8 w-8 text-text-tertiary hover:text-text-secondary"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h3
                        className="font-serif font-medium text-text-primary text-lg leading-tight line-clamp-2 cursor-pointer hover:text-amber-400 transition-colors"
                        onClick={() => navigate(`/read/${document.id}`)}
                      >
                        {document.title}
                      </h3>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setIsEditing(true)}
                          className="h-7 w-7 text-text-tertiary hover:text-amber-400"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setIsDeleting(true)}
                          className="h-7 w-7 text-text-tertiary hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-text-tertiary font-counter mb-4">
                  <span>{document.tokenCount.toLocaleString()} words</span>
                  <span className="text-border">•</span>
                  <span>{document.wpm} WPM</span>
                  <span className="text-border">•</span>
                  <span>{formatDate(document.updatedAt)}</span>
                </div>

                <div className="space-y-2">
                  <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, delay: animationDelay + 0.2, ease: 'easeOut' }}
                      className="h-full bg-amber-500 rounded-full shadow-[0_0_8px_rgba(240,166,35,0.4)]"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs font-counter">
                    <span className="text-text-tertiary">
                      {hasStarted ? `${Math.round(progress)}% complete` : 'Not started'}
                    </span>
                    {isCompleted && (
                      <span className="text-green-500 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Finished
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate(`/read/${document.id}`)}
                className="w-full px-5 py-3 bg-bg-surface border-t border-border flex items-center justify-center gap-2 text-sm font-medium text-text-secondary hover:text-amber-400 hover:bg-bg-surface/80 transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                {hasStarted ? 'Continue Reading' : 'Start Reading'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});
