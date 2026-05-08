/**
 * useDebugMode — subscribes to user settings and returns the current
 * `debugMode` flag. Drives every developer-only affordance (Debug enrichment
 * tab, raw payload viewers) so they all toggle together from one switch in
 * the Profile page.
 *
 * Pure hook: no side effects beyond an eventBus subscription on mount + a
 * load request to seed the initial value.
 */

import { useEffect, useState } from 'react';
import { eventBus } from '@cyberfabric/react';
import { loadUserSettings } from '@/app/actions/userSettingsActions';

export function useDebugMode(): boolean {
  const [debugMode, setDebugMode] = useState<boolean>(false);

  useEffect(() => {
    const loadedSub = eventBus.on('user/settings/loaded', ({ settings }) => {
      setDebugMode(settings.debugMode);
    });
    const updatedSub = eventBus.on('user/settings/updated', ({ settings }) => {
      setDebugMode(settings.debugMode);
    });
    loadUserSettings();
    return () => {
      loadedSub.unsubscribe();
      updatedSub.unsubscribe();
    };
  }, []);

  return debugMode;
}
