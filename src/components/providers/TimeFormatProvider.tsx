'use client';

import * as React from 'react';
import {
  DEFAULT_DISPLAY_TIMEZONE_MODE,
  DEFAULT_TIME_FORMAT,
  isDisplayTimezoneMode,
  isTimeFormat,
  type DisplayTimezoneMode,
  type TimeFormat,
} from '@/lib/utils/timeFormat';
import { detectBrowserTimezone } from '@/lib/hooks/useTimezone';

const SETTING_KEY = 'timeFormat';
const TIMEZONE_SETTING_KEY = 'timezone';
const TIMEZONE_CACHE_KEY = 'prism:timezone';
const DISPLAY_TIMEZONE_MODE_KEY = 'prism:display-timezone-mode';
export const TIMEZONE_CHANGED_EVENT = 'prism:timezone-changed';

interface TimeFormatContextValue {
  timeFormat: TimeFormat;
  setTimeFormat: (next: TimeFormat) => Promise<void>;
  householdTimezone: string;
  deviceTimezone: string;
  displayTimezone: string;
  displayTimezoneMode: DisplayTimezoneMode;
  setDisplayTimezoneMode: (next: DisplayTimezoneMode) => void;
}

const BACKFILL_ATTEMPTED_KEY = 'prism:timezone-backfill-attempted';

/**
 * Installs set up before the wizard could save a time zone have no household
 * zone on the server, which then has nothing but its own process zone to work
 * out "today" from. Save the zone this device is already showing as the
 * household one: a choice it cached from Settings, else what it detects. Only
 * a parent session can write it, so on a logged-out wall display this is one
 * refused request per page load and nothing else. UTC is never saved:
 * it is what a kiosk with an unset clock reports, and a real UTC household
 * can still pick it in Settings.
 */
function backfillHouseholdTimezone() {
  try {
    if (sessionStorage.getItem(BACKFILL_ATTEMPTED_KEY)) return;
  } catch {
    return;
  }
  const zone = localStorage.getItem(TIMEZONE_CACHE_KEY) || detectBrowserTimezone();
  if (!zone || zone === 'UTC' || zone.startsWith('Etc/')) return;
  fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: TIMEZONE_SETTING_KEY, value: zone }),
  })
    .then((response) => {
      // A 401 is a logged-out display: leave the attempt open so a parent who
      // signs in later in this tab still saves it. Anything else is final.
      if (response.status === 401) return;
      try { sessionStorage.setItem(BACKFILL_ATTEMPTED_KEY, '1'); } catch { /* ignore */ }
    })
    .catch(() => {});
}

const TimeFormatContext = React.createContext<TimeFormatContextValue | undefined>(undefined);

export function TimeFormatProvider({ children }: { children: React.ReactNode }) {
  const [timeFormat, setTimeFormatState] = React.useState<TimeFormat>(DEFAULT_TIME_FORMAT);
  const [deviceTimezone, setDeviceTimezone] = React.useState('UTC');
  const [householdTimezone, setHouseholdTimezone] = React.useState('UTC');
  const [displayTimezoneMode, setDisplayTimezoneModeState] = React.useState<DisplayTimezoneMode>(
    DEFAULT_DISPLAY_TIMEZONE_MODE,
  );

  React.useEffect(() => {
    const detected = detectBrowserTimezone();
    setDeviceTimezone(detected);
    setHouseholdTimezone(localStorage.getItem(TIMEZONE_CACHE_KEY) || detected);
    const savedMode = localStorage.getItem(DISPLAY_TIMEZONE_MODE_KEY);
    if (isDisplayTimezoneMode(savedMode)) setDisplayTimezoneModeState(savedMode);
  }, []);

  React.useEffect(() => {
    let active = true;
    fetch('/api/settings')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const saved = data?.settings?.[SETTING_KEY];
        if (active && isTimeFormat(saved)) setTimeFormatState(saved);
        const savedTimezone = data?.settings?.[TIMEZONE_SETTING_KEY];
        if (active && typeof savedTimezone === 'string' && savedTimezone) {
          setHouseholdTimezone(savedTimezone);
          localStorage.setItem(TIMEZONE_CACHE_KEY, savedTimezone);
        } else if (data?.settings) {
          backfillHouseholdTimezone();
        }
      })
      .catch(() => {});

    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    const handleTimezoneChanged = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (typeof next === 'string' && next) setHouseholdTimezone(next);
    };
    window.addEventListener(TIMEZONE_CHANGED_EVENT, handleTimezoneChanged);
    return () => window.removeEventListener(TIMEZONE_CHANGED_EVENT, handleTimezoneChanged);
  }, []);

  const setTimeFormat = React.useCallback(async (next: TimeFormat) => {
    const previous = timeFormat;
    setTimeFormatState(next);

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SETTING_KEY, value: next }),
      });
      if (!response.ok) throw new Error('Failed to save time format');
    } catch (error) {
      setTimeFormatState(previous);
      throw error;
    }
  }, [timeFormat]);

  const setDisplayTimezoneMode = React.useCallback((next: DisplayTimezoneMode) => {
    setDisplayTimezoneModeState(next);
    localStorage.setItem(DISPLAY_TIMEZONE_MODE_KEY, next);
  }, []);

  const displayTimezone = displayTimezoneMode === 'device'
    ? deviceTimezone
    : householdTimezone;

  const value = React.useMemo(
    () => ({
      timeFormat,
      setTimeFormat,
      householdTimezone,
      deviceTimezone,
      displayTimezone,
      displayTimezoneMode,
      setDisplayTimezoneMode,
    }),
    [
      timeFormat,
      setTimeFormat,
      householdTimezone,
      deviceTimezone,
      displayTimezone,
      displayTimezoneMode,
      setDisplayTimezoneMode,
    ],
  );

  return (
    <TimeFormatContext.Provider value={value}>
      {children}
    </TimeFormatContext.Provider>
  );
}

export function useTimeFormat(): TimeFormatContextValue {
  const context = React.useContext(TimeFormatContext);
  if (!context) throw new Error('useTimeFormat must be used within a TimeFormatProvider');
  return context;
}
