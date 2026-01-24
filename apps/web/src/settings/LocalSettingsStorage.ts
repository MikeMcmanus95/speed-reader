import type { UserSettings, UpdateSettingsRequest } from '@speed-reader/types';
import { DEFAULT_SETTINGS } from '@speed-reader/types';

const STORAGE_KEY = 'rsvp-user-settings';

/**
 * Manages settings stored in localStorage for anonymous users
 */
export class LocalSettingsStorage {
  /**
   * Check if there are settings stored locally
   */
  hasSettings(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get settings from localStorage, returning defaults if not found
   */
  getSettings(): UserSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<UserSettings>;
        // Merge with defaults to ensure all fields are present
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (err) {
      console.error('Failed to load settings from localStorage:', err);
    }
    return { ...DEFAULT_SETTINGS };
  }

  /**
   * Update settings in localStorage
   * Accepts a partial update - merges with existing settings
   */
  updateSettings(updates: UpdateSettingsRequest): UserSettings {
    const current = this.getSettings();
    const merged = { ...current, ...updates };

    // Handle nested pauseMultipliers merge
    if (updates.pauseMultipliers) {
      merged.pauseMultipliers = {
        ...current.pauseMultipliers,
        ...updates.pauseMultipliers,
      };
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (err) {
      console.error('Failed to save settings to localStorage:', err);
    }

    return merged;
  }

  /**
   * Clear settings from localStorage (used after migration to remote)
   */
  clearSettings(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear settings from localStorage:', err);
    }
  }
}

export const localSettingsStorage = new LocalSettingsStorage();
