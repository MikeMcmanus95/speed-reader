import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, RotateCcw, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Slider,
  Toggle,
  cn,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@speed-reader/ui';
import type { FontSize, UserSettings, PauseMultipliers } from '@speed-reader/types';
import { DEFAULT_SETTINGS } from '@speed-reader/types';
import { useSettings } from '../contexts/SettingsContext';
import { UserMenu } from '../components/UserMenu';

function SettingsView() {
  const navigate = useNavigate();
  const { settings, updateSettings, resetToDefaults, isLoading } = useSettings();
  const [isSaving, setIsSaving] = useState(false);

  // Draft state - local copy of settings that user modifies
  const [draftSettings, setDraftSettings] = useState<UserSettings>(settings);

  // Modal states
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Sync draft with settings when settings load
  useEffect(() => {
    if (!isLoading) {
      setDraftSettings(settings);
    }
  }, [settings, isLoading]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draftSettings) !== JSON.stringify(settings),
    [draftSettings, settings]
  );

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Update draft settings (no persistence)
  const handleSettingChange = useCallback(
    (updates: Partial<Omit<UserSettings, 'pauseMultipliers'> & { pauseMultipliers?: Partial<PauseMultipliers> }>) => {
      setDraftSettings((prev) => ({
        ...prev,
        ...updates,
        pauseMultipliers: updates.pauseMultipliers
          ? { ...prev.pauseMultipliers, ...updates.pauseMultipliers }
          : prev.pauseMultipliers,
      }));
    },
    []
  );

  // Save draft to persistence
  const handleSave = useCallback(async () => {
    if (isSaving) return; // Prevent double-clicks
    setIsSaving(true);
    try {
      await updateSettings(draftSettings);
      toast.success('Settings saved successfully');
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [draftSettings, updateSettings, isSaving]);

  // Discard changes and reset draft
  const handleDiscard = useCallback((navigate = true) => {
    setDraftSettings(settings);
    setIsDiscardDialogOpen(false);
    if (navigate && pendingNavigation) {
      pendingNavigation();
    }
    setPendingNavigation(null);
  }, [settings, pendingNavigation]);

  // Reset to defaults with confirmation
  const handleResetConfirm = useCallback(async () => {
    setIsSaving(true);
    try {
      await resetToDefaults();
      setDraftSettings(DEFAULT_SETTINGS);
      setIsResetDialogOpen(false);
      toast.success('Settings reset to defaults');
    } catch (err) {
      console.error('Failed to reset settings:', err);
      toast.error('Failed to reset settings');
    } finally {
      setIsSaving(false);
    }
  }, [resetToDefaults]);

  // Handle back navigation with unsaved changes check
  const handleBackClick = useCallback(() => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => () => navigate(-1));
      setIsDiscardDialogOpen(true);
    } else {
      navigate(-1);
    }
  }, [hasUnsavedChanges, navigate]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-warm-gradient bg-grain items-center justify-center">
        <div className="text-text-secondary font-rsvp text-xl italic">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-gradient bg-grain">
      <header className="sticky top-0 z-20 bg-bg-base/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackClick}
              className="gap-2 text-text-secondary hover:text-amber-400 hover:bg-bg-surface"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <UserMenu />
          </motion.div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 pb-32 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl md:text-3xl font-serif font-semibold text-text-primary mb-2">
            Settings
          </h1>
          <p className="text-text-secondary mb-8">
            Customize your reading experience. These settings apply as defaults for new documents.
          </p>

          <div className="space-y-8">
            {/* Reading Speed Section */}
            <SettingsSection title="Reading Speed" description="Control how fast words are displayed">
              <SettingsRow label="Default WPM" description="Words per minute when opening a new document">
                <div className="flex items-center gap-4 w-full max-w-xs">
                  <Slider
                    value={[draftSettings.defaultWpm]}
                    min={50}
                    max={1000}
                    step={10}
                    onValueChange={([value]) => handleSettingChange({ defaultWpm: value })}
                    className="flex-1"
                    disabled={isSaving}
                  />
                  <span className="font-counter text-amber-400 w-16 text-right">
                    {draftSettings.defaultWpm}
                  </span>
                </div>
              </SettingsRow>

              <SettingsRow label="Words per display" description="Number of words shown at once">
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map((size) => (
                    <button
                      key={size}
                      onClick={() => handleSettingChange({ defaultChunkSize: size })}
                      disabled={isSaving}
                      className={cn(
                        "px-4 py-2 rounded-lg font-counter text-sm transition-all cursor-pointer",
                        draftSettings.defaultChunkSize === size
                          ? "bg-amber-500 text-bg-deep"
                          : "bg-bg-surface text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </SettingsRow>

              <SettingsRow label="Auto-play on open" description="Start playing automatically when opening a document">
                <Toggle
                  pressed={draftSettings.autoPlayOnOpen}
                  onPressedChange={(pressed) => handleSettingChange({ autoPlayOnOpen: pressed })}
                  disabled={isSaving}
                  variant="outline"
                  className="data-[state=on]:bg-amber-500 data-[state=on]:text-bg-deep"
                >
                  {draftSettings.autoPlayOnOpen ? 'On' : 'Off'}
                </Toggle>
              </SettingsRow>
            </SettingsSection>

            {/* Display Section */}
            <SettingsSection title="Display" description="Customize the appearance of the reader">
              <SettingsRow label="Font size" description="Size of the words in the reader">
                <div className="flex items-center gap-2">
                  {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => handleSettingChange({ fontSize: size })}
                      disabled={isSaving}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm transition-all capitalize cursor-pointer",
                        draftSettings.fontSize === size
                          ? "bg-amber-500 text-bg-deep"
                          : "bg-bg-surface text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </SettingsRow>
            </SettingsSection>

            {/* Pause Timing Section */}
            <SettingsSection title="Pause Timing" description="Control pauses at punctuation">
              <SettingsRow label="Comma pause" description="Pause multiplier at commas (1x = no extra pause)">
                <div className="flex items-center gap-4 w-full max-w-xs">
                  <Slider
                    value={[draftSettings.pauseMultipliers.comma * 10]}
                    min={10}
                    max={50}
                    step={1}
                    onValueChange={([value]) =>
                      handleSettingChange({
                        pauseMultipliers: { comma: value / 10 },
                      })
                    }
                    className="flex-1"
                    disabled={isSaving}
                  />
                  <span className="font-counter text-amber-400 w-16 text-right">
                    {draftSettings.pauseMultipliers.comma.toFixed(1)}x
                  </span>
                </div>
              </SettingsRow>

              <SettingsRow label="Sentence pause" description="Pause multiplier at sentence endings">
                <div className="flex items-center gap-4 w-full max-w-xs">
                  <Slider
                    value={[draftSettings.pauseMultipliers.sentence * 10]}
                    min={10}
                    max={50}
                    step={1}
                    onValueChange={([value]) =>
                      handleSettingChange({
                        pauseMultipliers: { sentence: value / 10 },
                      })
                    }
                    className="flex-1"
                    disabled={isSaving}
                  />
                  <span className="font-counter text-amber-400 w-16 text-right">
                    {draftSettings.pauseMultipliers.sentence.toFixed(1)}x
                  </span>
                </div>
              </SettingsRow>

              <SettingsRow label="Paragraph pause" description="Pause multiplier at paragraph breaks">
                <div className="flex items-center gap-4 w-full max-w-xs">
                  <Slider
                    value={[draftSettings.pauseMultipliers.paragraph * 10]}
                    min={10}
                    max={50}
                    step={1}
                    onValueChange={([value]) =>
                      handleSettingChange({
                        pauseMultipliers: { paragraph: value / 10 },
                      })
                    }
                    className="flex-1"
                    disabled={isSaving}
                  />
                  <span className="font-counter text-amber-400 w-16 text-right">
                    {draftSettings.pauseMultipliers.paragraph.toFixed(1)}x
                  </span>
                </div>
              </SettingsRow>
            </SettingsSection>

            {/* Reset Section */}
            <div className="pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setIsResetDialogOpen(true)}
                disabled={isSaving}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Defaults
              </Button>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Sticky Save Footer */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-30 bg-bg-elevated/95 backdrop-blur-md border-t border-border"
          >
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                You have unsaved changes
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => handleDiscard(false)}
                  disabled={isSaving}
                >
                  Discard
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingNavigation(null)}>
              Stay
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDiscard(true)}>
              Leave Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Defaults</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all settings to their default values and save immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleResetConfirm();
              }}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Resetting...
                </>
              ) : (
                'Reset & Save'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="bg-bg-elevated/50 rounded-xl p-6 border border-border-subtle">
      <h2 className="text-lg font-serif font-medium text-text-primary mb-1">{title}</h2>
      <p className="text-sm text-text-tertiary mb-6">{description}</p>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

interface SettingsRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        <div className="text-xs text-text-tertiary">{description}</div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export { SettingsView };
export default SettingsView;
