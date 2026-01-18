import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDocument } from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="text-center pb-8">
          <CardTitle className="text-3xl md:text-4xl font-bold text-primary-700">
            Speed Reader
          </CardTitle>
          <CardDescription className="text-neutral-600 text-base">
            Paste your text below to start reading
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Input
              type="text"
              placeholder="Document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
              className="h-12 text-base border-2 border-neutral-200 focus-visible:border-primary-700 focus-visible:ring-0"
            />

            <div className="relative">
              <Textarea
                placeholder="Paste your text here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isSubmitting}
                required
                className={cn(
                  "min-h-[300px] md:min-h-[400px] text-base leading-relaxed border-2 resize-y",
                  isOverLimit
                    ? "border-accent-500 focus-visible:border-accent-500"
                    : "border-neutral-200 focus-visible:border-primary-700",
                  "focus-visible:ring-0"
                )}
              />
              <div
                className={cn(
                  "absolute bottom-3 right-3 text-xs font-mono px-2 py-1 rounded bg-white",
                  isOverLimit ? "text-accent-500 font-semibold" : "text-neutral-400"
                )}
              >
                {sizeDisplay} / 1 MB
              </div>
            </div>

            {error && (
              <div className="p-3 bg-accent-50 border border-accent-500 rounded-lg text-accent-800 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!title.trim() || !content.trim() || isOverLimit || isSubmitting}
              className="h-12 text-lg font-semibold bg-primary-700 hover:bg-primary-800 active:bg-primary-900 disabled:bg-neutral-300"
            >
              {isSubmitting ? 'Processing...' : 'Start Reading'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
