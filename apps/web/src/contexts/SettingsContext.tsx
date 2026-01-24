import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { UserSettings, UpdateSettingsRequest } from '@speed-reader/types';
import { DEFAULT_SETTINGS } from '@speed-reader/types';
import {
  getSettings as getRemoteSettings,
  updateSettings as updateRemoteSettings,
} from '@speed-reader/api-client';
import { localSettingsStorage } from '../settings';
import { useAuthContext } from './AuthContext';

interface SettingsState {
  settings: UserSettings;
  isLoading: boolean;
}

interface SettingsContextValue extends SettingsState {
  updateSettings: (updates: UpdateSettingsRequest) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthContext();
  const [state, setState] = useState<SettingsState>({
    settings: DEFAULT_SETTINGS,
    isLoading: true,
  });

  // Load settings when auth state is determined
  useEffect(() => {
    if (isAuthLoading) {
      return; // Wait for auth to be determined
    }

    async function loadSettings() {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        if (isAuthenticated) {
          // Fetch settings from backend
          const remoteSettings = await getRemoteSettings();
          setState({ settings: remoteSettings, isLoading: false });
        } else {
          // Load from localStorage
          const localSettings = localSettingsStorage.getSettings();
          setState({ settings: localSettings, isLoading: false });
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
        // Fall back to defaults on error
        setState({ settings: DEFAULT_SETTINGS, isLoading: false });
      }
    }

    loadSettings();
  }, [isAuthenticated, isAuthLoading]);

  const updateSettings = useCallback(
    async (updates: UpdateSettingsRequest) => {
      const previousSettings = state.settings;

      // Optimistic update
      const optimisticSettings = {
        ...previousSettings,
        ...updates,
        pauseMultipliers: updates.pauseMultipliers
          ? { ...previousSettings.pauseMultipliers, ...updates.pauseMultipliers }
          : previousSettings.pauseMultipliers,
      };
      setState({ settings: optimisticSettings, isLoading: false });

      try {
        if (isAuthenticated) {
          // Save to backend
          const savedSettings = await updateRemoteSettings(updates);
          setState({ settings: savedSettings, isLoading: false });
        } else {
          // Save to localStorage
          const savedSettings = localSettingsStorage.updateSettings(updates);
          setState({ settings: savedSettings, isLoading: false });
        }
      } catch (err) {
        console.error('Failed to update settings:', err);
        // Rollback on error
        setState({ settings: previousSettings, isLoading: false });
        throw err;
      }
    },
    [isAuthenticated, state.settings]
  );

  const resetToDefaults = useCallback(async () => {
    await updateSettings(DEFAULT_SETTINGS);
  }, [updateSettings]);

  const value: SettingsContextValue = {
    ...state,
    updateSettings,
    resetToDefaults,
  };

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
