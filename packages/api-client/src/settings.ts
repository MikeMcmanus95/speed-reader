import type { UserSettings, UpdateSettingsRequest } from '@speed-reader/types';
import { get, put } from './client';

/**
 * Get the current user's settings
 * Returns the user's saved settings or defaults if none are saved
 */
export async function getSettings(): Promise<UserSettings> {
  return get<UserSettings>('/api/settings');
}

/**
 * Update the current user's settings
 * Accepts a partial update - only the fields provided will be changed
 */
export async function updateSettings(updates: UpdateSettingsRequest): Promise<UserSettings> {
  return put<UserSettings, UpdateSettingsRequest>('/api/settings', updates);
}
