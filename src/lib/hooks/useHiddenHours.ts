'use client';

import { useState, useEffect, useCallback } from 'react';

const HIDDEN_HOURS_KEY = 'prism:calendar-hidden-hours';

interface HiddenHoursSettings {
  /** Starting hour to hide (0-23) */
  startHour: number;
  /** Ending hour to hide (0-23, exclusive) */
  endHour: number;
  /** Whether the time block is currently hidden */
  enabled: boolean;
}

const DEFAULT_SETTINGS: HiddenHoursSettings = {
  startHour: 0,
  endHour: 6,
  enabled: false,
};

export function useHiddenHours() {
  const [settings, setSettingsState] = useState<HiddenHoursSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HIDDEN_HOURS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettingsState({
          startHour: typeof parsed.startHour === 'number' ? parsed.startHour : DEFAULT_SETTINGS.startHour,
          endHour: typeof parsed.endHour === 'number' ? parsed.endHour : DEFAULT_SETTINGS.endHour,
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_SETTINGS.enabled,
        });
      }
    } catch {
      // Use defaults
    }
    setLoaded(true);
  }, []);

  // Save to localStorage
  const setSettings = useCallback((newSettings: Partial<HiddenHoursSettings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(HIDDEN_HOURS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  }, []);

  // Toggle hidden state
  const toggleHidden = useCallback(() => {
    setSettings({ enabled: !settings.enabled });
  }, [settings.enabled, setSettings]);

  // Set time range
  const setTimeRange = useCallback((startHour: number, endHour: number) => {
    setSettings({ startHour, endHour });
  }, [setSettings]);

  // Get visible hours based on settings
  const getVisibleHours = useCallback((): number[] => {
    const allHours = Array.from({ length: 24 }, (_, i) => i);
    if (!settings.enabled) {
      return allHours;
    }
    // Filter out hidden hours
    return allHours.filter((hour) => {
      // Handle wrap-around (e.g., 22:00 to 6:00)
      if (settings.startHour <= settings.endHour) {
        return hour < settings.startHour || hour >= settings.endHour;
      } else {
        // Wrap-around case
        return hour >= settings.endHour && hour < settings.startHour;
      }
    });
  }, [settings.enabled, settings.startHour, settings.endHour]);

  return {
    settings,
    loaded,
    setSettings,
    toggleHidden,
    setTimeRange,
    getVisibleHours,
  };
}
