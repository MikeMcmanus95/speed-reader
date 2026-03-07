import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@speed-reader/types';
import { LocalSettingsStorage } from './LocalSettingsStorage';

describe('LocalSettingsStorage', () => {
  const storageKey = 'rsvp-user-settings';
  let storage: LocalSettingsStorage;

  beforeEach(() => {
    localStorage.clear();
    storage = new LocalSettingsStorage();
  });

  it('deep-merges stored pauseMultipliers with defaults in getSettings', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        pauseMultipliers: {
          sentence: 2.4,
        },
      })
    );

    const settings = storage.getSettings();

    expect(settings.pauseMultipliers).toEqual({
      ...DEFAULT_SETTINGS.pauseMultipliers,
      sentence: 2.4,
    });
    expect(settings.defaultWpm).toBe(DEFAULT_SETTINGS.defaultWpm);
    expect(settings.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });
});
