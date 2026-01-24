import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@speed-reader/ui';
import type { DocumentWithProgress } from '@speed-reader/types';
import { DocumentCard } from '../components/DocumentCard';
import { EditDocumentModal } from '../components/EditDocumentModal';
import { UserMenu } from '../components/UserMenu';
import { useDocumentStorage } from '../storage';

function LibraryView() {
  const navigate = useNavigate();
  const storage = useDocumentStorage();
  const storageRef = useRef(storage);
  storageRef.current = storage;
  const [documents, setDocuments] = useState<DocumentWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<DocumentWithProgress | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await storageRef.current.listDocuments();
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

  const handleEdit = (document: DocumentWithProgress) => {
    setEditingDocument(document);
  };

  const handleUpdate = (updatedDoc: DocumentWithProgress) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === updatedDoc.id ? updatedDoc : doc))
    );
  };

  const handleDelete = async (id: string) => {
    await storageRef.current.deleteDocument(id);
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
              <img src="/logo.svg" alt="Speed Reader" className="w-6 h-6" />
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
                onEdit={handleEdit}
                onDelete={handleDelete}
                animationDelay={index * 0.08}
              />
            ))}
          </div>
        )}
      </main>

      <EditDocumentModal
        isOpen={!!editingDocument}
        onClose={() => setEditingDocument(null)}
        document={editingDocument}
        onUpdate={handleUpdate}
      />
    </div>
  );
}

export { LibraryView };
export default LibraryView;
