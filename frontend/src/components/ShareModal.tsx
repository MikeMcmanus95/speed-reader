import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Link2, Copy, Check, Globe, Lock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../hooks/useAuth';
import {
  getShareInfo,
  generateShareToken,
  revokeShareToken,
  setVisibility,
} from '../api/auth';
import type { ShareInfo } from '../types/user';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
}

export function ShareModal({ isOpen, onClose, documentId, documentTitle }: ShareModalProps) {
  const { getAccessToken } = useAuth();
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShareInfo = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const info = await getShareInfo(documentId, token);
      setShareInfo(info);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load share info');
    } finally {
      setIsLoading(false);
    }
  }, [documentId, getAccessToken]);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchShareInfo();
    }
  }, [isOpen, fetchShareInfo]);

  const handleGenerateLink = async () => {
    setIsUpdating(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const info = await generateShareToken(documentId, token);
      setShareInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRevokeLink = async () => {
    setIsUpdating(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      await revokeShareToken(documentId, token);
      setShareInfo((prev) => prev ? { ...prev, shareToken: undefined, shareUrl: undefined } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share link');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!shareInfo) return;
    setIsUpdating(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const newVisibility = shareInfo.visibility === 'private' ? 'public' : 'private';
      const info = await setVisibility(documentId, newVisibility, token);
      setShareInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visibility');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareInfo?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareInfo.shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setError('Failed to copy link');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
          >
            <div
              className="w-full max-w-md bg-bg-elevated border border-border rounded-xl shadow-2xl shadow-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="font-serif font-semibold text-lg text-text-primary">
                      Share Document
                    </h2>
                    <p className="text-sm text-text-secondary truncate max-w-[200px]">
                      {documentTitle}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-bg-surface transition-colors"
                >
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-text-tertiary">Loading...</div>
                  </div>
                ) : error ? (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                    {error}
                  </div>
                ) : (
                  <>
                    {/* Visibility Toggle */}
                    <div className="flex items-center justify-between p-3 bg-bg-surface rounded-lg">
                      <div className="flex items-center gap-3">
                        {shareInfo?.visibility === 'public' ? (
                          <Globe className="w-5 h-5 text-amber-400" />
                        ) : (
                          <Lock className="w-5 h-5 text-text-tertiary" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-text-primary">
                            {shareInfo?.visibility === 'public' ? 'Public' : 'Private'}
                          </div>
                          <div className="text-xs text-text-secondary">
                            {shareInfo?.visibility === 'public'
                              ? 'Anyone with the link can view'
                              : 'Only you can view'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleToggleVisibility}
                        disabled={isUpdating}
                        className="px-3 py-1.5 text-sm rounded-lg bg-bg-elevated hover:bg-bg-base transition-colors disabled:opacity-50"
                      >
                        {isUpdating ? '...' : 'Change'}
                      </button>
                    </div>

                    {/* Share Link Section */}
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-text-primary">
                        Share Link
                      </div>

                      {shareInfo?.shareUrl ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 p-3 bg-bg-surface rounded-lg font-mono text-sm text-text-secondary truncate">
                              {shareInfo.shareUrl}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCopyLink}
                              className="shrink-0 gap-2"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-4 h-4 text-green-500" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  Copy
                                </>
                              )}
                            </Button>
                          </div>
                          <button
                            onClick={handleRevokeLink}
                            disabled={isUpdating}
                            className="flex items-center gap-2 text-sm text-text-tertiary hover:text-destructive transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Revoke link
                          </button>
                        </div>
                      ) : (
                        <Button
                          onClick={handleGenerateLink}
                          disabled={isUpdating}
                          className="w-full gap-2"
                        >
                          <Link2 className="w-4 h-4" />
                          {isUpdating ? 'Generating...' : 'Generate Share Link'}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
