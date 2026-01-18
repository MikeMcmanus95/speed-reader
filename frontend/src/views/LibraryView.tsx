import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Plus, Library, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentCard } from '../components/DocumentCard';
import { UserMenu } from '../components/UserMenu';
import { listDocuments, updateDocument, deleteDocument } from '../api';
import type { DocumentWithProgress } from '../types';

function LibraryView() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleRename = async (id: string, title: string) => {
    await updateDocument(id, { title });
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, title } : doc))
    );
  };

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  return (
    <div className="min-h-screen bg-warm-gradient bg-grain">
      <header className="sticky top-0 z-20 bg-bg-base/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3"
          >
            <button
              onClick={() => navigate('/')}
              className="p-1 -m-1 rounded-lg hover:bg-bg-elevated transition-colors cursor-pointer"
              aria-label="Go to new document"
            >
              <Library className="w-6 h-6 text-amber-400" />
            </button>
            <h1 className="text-xl md:text-2xl font-serif font-semibold text-text-primary">
              My Library
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-4"
          >
            <Button
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              New Document
            </Button>
            <UserMenu />
          </motion.div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 relative z-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-text-tertiary"
            >
              Loading documents...
            </motion.div>
          </div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm text-center"
          >
            {error}
          </motion.div>
        ) : documents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-bg-elevated flex items-center justify-center mb-6">
              <FileText className="w-10 h-10 text-text-tertiary" />
            </div>
            <h2 className="text-xl font-serif font-medium text-text-primary mb-2">
              No documents yet
            </h2>
            <p className="text-text-secondary mb-6 max-w-sm">
              Create your first document to start speed reading. Paste any text and let the reader help you absorb it faster.
            </p>
            <Button onClick={() => navigate('/')} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Document
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {documents.map((doc, index) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onRename={handleRename}
                onDelete={handleDelete}
                animationDelay={index * 0.08}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export { LibraryView };
export default LibraryView;
