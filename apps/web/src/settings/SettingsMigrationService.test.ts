import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@speed-reader/types';
import { updateSettings as updateRemoteSettings } from '@speed-reader/api-client';
import { SettingsMigrationService } from './SettingsMigrationService';

vi.mock('@speed-reader/api-client', () => ({
  updateSettings: vi.fn(),
}));

describe('SettingsMigrationService', () => {
  const storageKey = 'rsvp-user-settings';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('uploads local settings and clears local storage on success', async () => {
    const localSettings = {
      ...DEFAULT_SETTINGS,
      defaultChunkSize: 3,
    };
    localStorage.setItem(storageKey, JSON.stringify(localSettings));
    vi.mocked(updateRemoteSettings).mockResolvedValue(localSettings);

    const service = new SettingsMigrationService();
    await service.migrateSettings();

    expect(updateRemoteSettings).toHaveBeenCalledWith(localSettings);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it('keeps local settings when remote migration fails', async () => {
    const localSettings = {
      ...DEFAULT_SETTINGS,
      defaultChunkSize: 2,
    };
    localStorage.setItem(storageKey, JSON.stringify(localSettings));
    vi.mocked(updateRemoteSettings).mockRejectedValue(new Error('migration failed'));

    const service = new SettingsMigrationService();
    await expect(service.migrateSettings()).rejects.toThrow('migration failed');

    expect(localStorage.getItem(storageKey)).not.toBeNull();
  });

  it('skips migration when there are no local settings', async () => {
    const service = new SettingsMigrationService();
    await service.migrateSettings();

    expect(updateRemoteSettings).not.toHaveBeenCalled();
  });
});
