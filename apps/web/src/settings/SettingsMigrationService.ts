import { localSettingsStorage } from './LocalSettingsStorage';
import { updateSettings as updateRemoteSettings } from '@speed-reader/api-client';

/**
 * Service to migrate settings from localStorage to backend when user logs in
 */
export class SettingsMigrationService {
  /**
   * Check if there are local settings to migrate
   */
  hasLocalSettings(): boolean {
    return localSettingsStorage.hasSettings();
  }

  /**
   * Migrate local settings to remote storage
   * Should be called after successful authentication
   */
  async migrateSettings(): Promise<void> {
    if (!this.hasLocalSettings()) {
      return;
    }

    const localSettings = localSettingsStorage.getSettings();

    try {
      // Upload local settings to backend
      await updateRemoteSettings(localSettings);
      // Clear local settings after successful migration
      localSettingsStorage.clearSettings();
    } catch (err) {
      console.error('Failed to migrate settings to remote:', err);
      // Don't clear local settings on failure - user can try again
      throw err;
    }
  }
}
