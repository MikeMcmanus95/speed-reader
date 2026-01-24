import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Library } from 'lucide-react';
import { createDocument } from '@speed-reader/api-client';
import { Button, Input, Textarea, Card, CardHeader, CardTitle, CardDescription, CardContent, cn } from '@speed-reader/ui';
import { UserMenu } from '../components/UserMenu';
import { useUser } from '../hooks/useAuth';

const GUEST_MAX_SIZE = 1024 * 1024; // 1MB
const AUTH_MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function PasteInputView() {
  const navigate = useNavigate();
  const user = useUser();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authenticated (non-guest) users get a higher limit
  const maxSize = user && !user.isGuest ? AUTH_MAX_SIZE : GUEST_MAX_SIZE;
  const maxSizeDisplay = user && !user.isGuest ? '10 MB' : '1 MB';

  const contentSize = new Blob([content]).size;
  const isOverLimit = contentSize > maxSize;
  const sizeDisplay = contentSize > 1024
    ? `${(contentSize / 1024).toFixed(1)} KB`
    : `${contentSize} bytes`;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isOverLimit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const doc = await createDocument({
        title: title.trim(), // Server generates random name if empty
        content,
      });
      navigate(`/read/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
      setIsSubmitting(false);
    }
  }, [title, content, isOverLimit, isSubmitting, navigate]);

  return (
    <div className="min-h-screen bg-warm-gradient bg-grain flex flex-col">
      {/* Header with My Library and UserMenu */}
      <header className="fixed top-0 right-0 z-20 p-4 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/library')}
          className="gap-2"
        >
          <Library className="w-4 h-4" />
          My Library
        </Button>
        <UserMenu />
      </header>

      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="max-w-2xl w-full relative z-10">
          <Card className="border border-border bg-bg-elevated/95 backdrop-blur-sm shadow-2xl shadow-black/30">
            <CardHeader className="text-center pb-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="flex items-center justify-center gap-3"
              >
                <img src="/logo.svg" alt="Speed Reader" className="w-10 h-10 md:w-12 md:h-12" />
                <CardTitle className="text-4xl md:text-5xl font-serif font-semibold bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                  Speed Reader
                </CardTitle>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
              >
                <CardDescription className="text-text-secondary text-base mt-2 font-serif italic">
                  Paste your text below to begin
                </CardDescription>
              </motion.div>
            </CardHeader>

            <CardContent>
              <motion.form
                className="flex flex-col gap-5"
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
              >
                <div className="relative">
                  <Textarea
                    placeholder="Paste your text here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={isSubmitting}
                    required
                    className={cn(
                      "min-h-[280px] md:min-h-[360px] max-h-[50vh] text-base leading-relaxed resize-y",
                      isOverLimit && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30"
                    )}
                  />
                  <div
                    className={cn(
                      "absolute bottom-3 right-3 text-xs font-counter px-2 py-1 rounded bg-bg-elevated/90",
                      isOverLimit ? "text-destructive font-semibold" : "text-text-tertiary"
                    )}
                  >
                    {sizeDisplay} / {maxSizeDisplay}
                  </div>
                </div>

                <AnimatePresence>
                  {content.trim() && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <Input
                        type="text"
                        placeholder="Document title (optional)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isSubmitting}
                        className="h-12 text-base"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                <Button
                  type="submit"
                  disabled={!content.trim() || isOverLimit || isSubmitting}
                  size="lg"
                  className="h-12 text-lg font-semibold"
                >
                  {isSubmitting ? 'Processing...' : 'Start Reading'}
                </Button>
              </motion.form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
