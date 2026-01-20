import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@speed-reader/ui';
import { useSyncStatus } from '../../sync/useSyncStatus';
import { getSyncManager } from '../../sync/SyncManager';
import { useAuth } from '../../auth/AuthContext';

export function SyncIndicator() {
  const { isAuthenticated } = useAuth();
  const status = useSyncStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const syncManager = getSyncManager();
      await syncManager.syncAll();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Don't show if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Offline
  if (!status.isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-text-tertiary" title="Offline">
        <CloudOff className="w-3.5 h-3.5" />
        <span>Offline</span>
      </div>
    );
  }

  // Syncing
  if (status.isSyncing || isSyncing) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-400" title="Syncing...">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Syncing</span>
      </div>
    );
  }

  // Error
  if (status.error) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSync}
        className="gap-1.5 text-destructive hover:text-destructive"
        title={`Sync error: ${status.error}`}
      >
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Error</span>
      </Button>
    );
  }

  // Pending changes
  if (status.pendingCount > 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSync}
        className="gap-1.5 text-amber-400 hover:text-amber-300"
        title={`${status.pendingCount} pending`}
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>{status.pendingCount}</span>
      </Button>
    );
  }

  // Synced
  return (
    <div
      className="flex items-center gap-1.5 text-xs text-text-tertiary cursor-pointer hover:text-text-secondary"
      onClick={handleSync}
      title={status.lastSync ? `Last sync: ${formatLastSync(status.lastSync)}` : 'Synced'}
    >
      <Check className="w-3.5 h-3.5 text-green-500" />
      <Cloud className="w-3.5 h-3.5" />
    </div>
  );
}

function formatLastSync(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}
