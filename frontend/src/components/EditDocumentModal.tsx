import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, AlertCircle, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getDocumentContent, updateDocument } from '../api';
import type { DocumentWithProgress } from '../types';

interface EditDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentWithProgress | null;
  onUpdate: (updatedDoc: DocumentWithProgress) => void;
}

export function EditDocumentModal({ isOpen, onClose, document, onUpdate }: EditDocumentModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [hasContent, setHasContent] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const fetchContent = useCallback(async () => {
    if (!document) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await getDocumentContent(document.id);
      setContent(response.content);
      setOriginalContent(response.content);
      setHasContent(response.hasContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document content');
    } finally {
      setIsLoading(false);
    }
  }, [document]);

  useEffect(() => {
    if (isOpen && document) {
      setTitle(document.title);
      fetchContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, document?.id]);

  useEffect(() => {
    if (isOpen && !isLoading && hasContent && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isOpen, isLoading, hasContent]);

  const handleSave = async () => {
    if (!document) return;

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Determine if we need to update content or just title
      const contentChanged = content !== originalContent;
      const titleChanged = title !== document.title;

      if (!contentChanged && !titleChanged) {
        onClose();
        return;
      }

      const updatedDoc = await updateDocument(document.id, {
        title: title.trim(),
        ...(contentChanged ? { content } : {}),
      });

      // Merge updated doc with progress info
      onUpdate({
        ...updatedDoc,
        tokenIndex: contentChanged ? 0 : document.tokenIndex, // Reset progress if content changed
        wpm: document.wpm,
        updatedAt: new Date().toISOString(),
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const contentChanged = content !== originalContent;
  const titleChanged = title !== document?.title;
  const hasChanges = contentChanged || titleChanged;

  return (
    <AnimatePresence>
      {isOpen && document && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onKeyDown={handleKeyDown}
          >
            <div
              className="w-full max-w-3xl bg-bg-elevated border border-border rounded-xl shadow-2xl shadow-black/40 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="font-serif font-semibold text-lg text-text-primary">
                      Edit Document
                    </h2>
                    <p className="text-sm text-text-secondary">
                      {hasContent ? 'Modify title and content' : 'Content not available'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  disabled={isSaving}
                  className="p-2 rounded-lg hover:bg-bg-surface transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                  </div>
                ) : !hasContent ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-bg-surface flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-text-tertiary" />
                    </div>
                    <div>
                      <h3 className="font-serif font-medium text-text-primary mb-2">
                        Content Not Available
                      </h3>
                      <p className="text-sm text-text-secondary max-w-md">
                        This document was created before content storage was added.
                        Only the processed tokens exist. Editing is not available for legacy documents.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Title Input */}
                    <div className="space-y-2">
                      <label htmlFor="edit-title" className="block text-sm font-medium text-text-primary">
                        Title
                      </label>
                      <Input
                        ref={titleInputRef}
                        id="edit-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter document title..."
                        disabled={isSaving}
                        maxLength={200}
                      />
                    </div>

                    {/* Content Textarea */}
                    <div className="space-y-2 flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <label htmlFor="edit-content" className="block text-sm font-medium text-text-primary">
                          Content
                        </label>
                        <span className="text-xs text-text-tertiary font-counter">
                          {wordCount.toLocaleString()} words
                        </span>
                      </div>
                      <Textarea
                        id="edit-content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Paste your text here..."
                        disabled={isSaving}
                        className="min-h-[300px] resize-none font-serif"
                      />
                    </div>

                    {/* Warning about progress reset */}
                    {contentChanged && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
                      >
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-text-secondary">
                          <span className="font-medium text-text-primary">Reading progress will be reset.</span>
                          {' '}Your reading position will return to the beginning when you save changes to the content.
                        </div>
                      </motion.div>
                    )}

                    {/* Error Message */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm"
                      >
                        {error}
                      </motion.div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              {hasContent && !isLoading && (
                <div className="flex items-center justify-between gap-3 p-4 border-t border-border shrink-0">
                  <p className="text-xs text-text-tertiary">
                    Press <kbd className="px-1.5 py-0.5 bg-bg-surface rounded text-text-secondary">Cmd+Enter</kbd> to save
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={onClose}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving || !hasChanges}
                      className="gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
