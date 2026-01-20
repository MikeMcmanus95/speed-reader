import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Trash2, Clock, Cloud, CloudOff, AlertCircle } from 'lucide-react';
import { Button, Card } from '@speed-reader/ui';
import { getAllDocuments, deleteDocument, type LocalDocument } from '../../storage/db';
import { LoginButton } from '../components/LoginButton';
import { SyncIndicator } from '../components/SyncIndicator';
import { useSyncStatus } from '../../sync/useSyncStatus';

interface LibraryViewProps {
  onSelect: (docId: string) => void;
  onBack: () => void;
}

export function LibraryView({ onSelect, onBack }: LibraryViewProps) {
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    setLoading(true);
    const docs = await getAllDocuments();
    setDocuments(docs);
    setLoading(false);
  }

  async function handleDelete(e: React.MouseEvent, docId: string) {
    e.stopPropagation();
    if (confirm('Delete this document?')) {
      await deleteDocument(docId);
      await loadDocuments();
    }
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="flex flex-col min-h-screen p-4">
      <header className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-lg font-semibold">Library</h1>
        <span className="text-sm text-text-tertiary">
          ({documents.length})
        </span>
        <div className="flex-1" />
        <SyncIndicator />
        <LoginButton />
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-text-secondary">Loading...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-text-secondary">No documents yet</p>
          <Button onClick={onBack}>Create Your First</Button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {documents.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className="p-3 cursor-pointer hover:bg-bg-elevated/80 transition-colors"
                onClick={() => onSelect(doc.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium truncate">{doc.title}</h2>
                      <SyncStatusIcon status={doc.syncStatus} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                      <span>{doc.tokenCount.toLocaleString()} words</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(doc.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-text-tertiary hover:text-destructive"
                    onClick={(e) => handleDelete(e, doc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function SyncStatusIcon({ status }: { status: LocalDocument['syncStatus'] }) {
  switch (status) {
    case 'synced':
      return (
        <span title="Synced">
          <Cloud className="w-3 h-3 text-green-500" />
        </span>
      );
    case 'pending':
      return (
        <span title="Pending sync">
          <Cloud className="w-3 h-3 text-amber-400" />
        </span>
      );
    case 'error':
      return (
        <span title="Sync error">
          <AlertCircle className="w-3 h-3 text-destructive" />
        </span>
      );
    case 'local':
    default:
      return (
        <span title="Local only">
          <CloudOff className="w-3 h-3 text-text-tertiary" />
        </span>
      );
  }
}
