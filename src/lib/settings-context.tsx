'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { settings as settingsApi } from './api';
import type { UserSettings } from '@/types';

interface SettingsContextValue extends UserSettings {
  loaded: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  setNotificationSoundEnabled: (value: boolean) => void;
}

const DEFAULTS: UserSettings = { notificationsEnabled: true, notificationSoundEnabled: true };

const SettingsContext = createContext<SettingsContextValue>({
  ...DEFAULTS,
  loaded: false,
  setNotificationsEnabled: () => {},
  setNotificationSoundEnabled: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    settingsApi.get()
      .then(setState)
      .catch(() => { /* not logged in yet, or request failed -- stay on defaults */ })
      .finally(() => setLoaded(true));
  }, []);

  // Optimistic: flip the switch instantly, persist in the background. If the
  // save fails, re-fetch to fall back to whatever the server actually has
  // rather than leaving the UI showing a state that didn't stick.
  const update = useCallback((patch: Partial<UserSettings>) => {
    setState(prev => ({ ...prev, ...patch }));
    settingsApi.update(patch).catch(() => {
      settingsApi.get().then(setState).catch(() => {});
    });
  }, []);

  const value: SettingsContextValue = {
    ...state,
    loaded,
    setNotificationsEnabled: (value: boolean) => update({ notificationsEnabled: value }),
    setNotificationSoundEnabled: (value: boolean) => update({ notificationSoundEnabled: value }),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
