import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DEFAULT_SETTINGS } from '@speed-reader/types';
import SettingsView from './SettingsView';

const mockUpdateSettings = vi.fn();
const mockResetToDefaults = vi.fn();

vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

const settingsState = {
  settings: DEFAULT_SETTINGS,
  updateSettings: mockUpdateSettings,
  resetToDefaults: mockResetToDefaults,
  isLoading: false,
};

vi.mock('../contexts/SettingsContext', () => ({
  useSettings: () => settingsState,
}));

vi.mock('../components/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

describe('SettingsView', () => {
  beforeEach(() => {
    settingsState.settings = { ...DEFAULT_SETTINGS };
    settingsState.isLoading = false;
    mockUpdateSettings.mockReset();
    mockResetToDefaults.mockReset();
    mockUpdateSettings.mockResolvedValue(DEFAULT_SETTINGS);
    mockResetToDefaults.mockResolvedValue(DEFAULT_SETTINGS);
  });

  it('explains immediate font-size behavior vs defaults', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByText(
        'Customize your reading experience. Font size updates the active reader immediately, while the other values are defaults for new documents.'
      )
    ).toBeInTheDocument();
  });

  it('discards unsaved changes and resumes pending navigation when leaving', async () => {
    render(
      <MemoryRouter initialEntries={['/library', '/settings']} initialIndex={1}>
        <Routes>
          <Route path="/library" element={<div data-testid="library-view">Library</div>} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Leave Without Saving' }));

    await waitFor(() => expect(screen.getByTestId('library-view')).toBeInTheDocument());
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });
});
