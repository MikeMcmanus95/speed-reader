import { useState, useEffect } from 'react';
import { getSyncManager, type SyncStatus } from './SyncManager';

const defaultStatus: SyncStatus = {
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSync: null,
  pendingCount: 0,
  error: null,
};

/**
 * React hook to subscribe to sync status changes
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(defaultStatus);

  useEffect(() => {
    try {
      const syncManager = getSyncManager();
      return syncManager.subscribe(setStatus);
    } catch {
      // SyncManager not initialized yet
      return undefined;
    }
  }, []);

  return status;
}
