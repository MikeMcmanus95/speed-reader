import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@speed-reader/types';
import { SettingsProvider, useSettings } from './SettingsContext';

const mockGetRemoteSettings = vi.fn();
const mockUpdateRemoteSettings = vi.fn();

let authState = {
  isAuthenticated: false,
  isLoading: false,
};

vi.mock('@speed-reader/api-client', () => ({
  getSettings: (...args: unknown[]) => mockGetRemoteSettings(...args),
  updateSettings: (...args: unknown[]) => mockUpdateRemoteSettings(...args),
}));

vi.mock('./AuthContext', () => ({
  useAuthContext: () => authState,
}));

function SettingsProbe() {
  const { settings, isLoading, updateSettings } = useSettings();

  return (
    <div>
      <div data-testid="is-loading">{String(isLoading)}</div>
      <div data-testid="chunk-size">{settings.defaultChunkSize}</div>
      <button type="button" onClick={() => void updateSettings({ defaultChunkSize: 1 })}>
        update-settings
      </button>
    </div>
  );
}

describe('SettingsContext', () => {
  const storageKey = 'rsvp-user-settings';

  beforeEach(() => {
    authState = {
      isAuthenticated: false,
      isLoading: false,
    };
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('uses API settings for authenticated users', async () => {
    authState.isAuthenticated = true;
    mockGetRemoteSettings.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      defaultChunkSize: 3,
    });
    mockUpdateRemoteSettings.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      defaultChunkSize: 1,
    });

    render(
      <SettingsProvider>
        <SettingsProbe />
      </SettingsProvider>
    );

    await waitFor(() => expect(mockGetRemoteSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('chunk-size')).toHaveTextContent('3'));

    fireEvent.click(screen.getByRole('button', { name: 'update-settings' }));

    await waitFor(() =>
      expect(mockUpdateRemoteSettings).toHaveBeenCalledWith({ defaultChunkSize: 1 })
    );
    await waitFor(() => expect(screen.getByTestId('chunk-size')).toHaveTextContent('1'));
  });

  it('uses localStorage settings for anonymous users', async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        defaultChunkSize: 2,
      })
    );
    mockGetRemoteSettings.mockResolvedValue(DEFAULT_SETTINGS);

    render(
      <SettingsProvider>
        <SettingsProbe />
      </SettingsProvider>
    );

    await waitFor(() => expect(screen.getByTestId('is-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('chunk-size')).toHaveTextContent('2');
    expect(mockGetRemoteSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'update-settings' }));

    await waitFor(() => expect(screen.getByTestId('chunk-size')).toHaveTextContent('1'));
    expect(mockUpdateRemoteSettings).not.toHaveBeenCalled();
    expect(localStorage.getItem(storageKey)).toContain('"defaultChunkSize":1');
  });
});
