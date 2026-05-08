'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CalendarEvent } from '@/types/calendar';

const HIDDEN_HOURS_KEY = 'prism:calendar-hidden-hours';

interface HiddenHoursSettings {
  /** Mode for hour filtering */
  mode: 'manual' | 'auto-fit';
  /** Starting hour to hide (0-23) */
  startHour: number;
  /** Ending hour to hide (0-23, exclusive) */
  endHour: number;
  /** Auto-fit buffer in hours to add around visible events */
  bufferHours: number;
  /** Whether the time block is currently hidden */
  enabled: boolean;
}

const DEFAULT_SETTINGS: HiddenHoursSettings = {
  mode: 'manual',
  startHour: 0,
  endHour: 6,
  bufferHours: 1,
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
          mode: typeof parsed.mode === 'string' && (parsed.mode === 'manual' || parsed.mode === 'auto-fit') ? parsed.mode : DEFAULT_SETTINGS.mode,
          startHour: typeof parsed.startHour === 'number' ? parsed.startHour : DEFAULT_SETTINGS.startHour,
          endHour: typeof parsed.endHour === 'number' ? parsed.endHour : DEFAULT_SETTINGS.endHour,
          bufferHours: typeof parsed.bufferHours === 'number' ? parsed.bufferHours : DEFAULT_SETTINGS.bufferHours,
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

  const clampHour = (hour: number) => Math.min(23, Math.max(0, hour));

  const getVisibleHours = useCallback((events?: CalendarEvent[], range?: { from: Date; to: Date }): number[] => {
    const allHours = Array.from({ length: 24 }, (_, i) => i);
    if (!settings.enabled) {
      return allHours;
    }

    if (settings.mode === 'manual') {
      return allHours.filter((hour) => {
        if (settings.startHour <= settings.endHour) {
          return hour < settings.startHour || hour >= settings.endHour;
        }
        return hour >= settings.endHour && hour < settings.startHour;
      });
    }

    if (settings.mode === 'auto-fit' && events && range) {
      const timedEvents = events.filter((event) =>
        !event.allDay && event.endTime > range.from && event.startTime < range.to
      );

      if (timedEvents.length === 0) {
        return allHours.filter((hour) => hour >= 8 && hour <= 18);
      }

      let minHour = 23;
      let maxHour = 0;

      for (const event of timedEvents) {
        const eventStart = event.startTime < range.from ? range.from : event.startTime;
        const eventEnd = event.endTime > range.to ? range.to : event.endTime;
        const startHour = eventStart.getHours();

        let endHour = eventEnd.getHours();
        if (
          eventEnd.getMinutes() === 0 &&
          eventEnd.getSeconds() === 0 &&
          eventEnd.getMilliseconds() === 0
        ) {
          endHour = Math.max(startHour, endHour - 1);
        }

        minHour = Math.min(minHour, startHour);
        maxHour = Math.max(maxHour, endHour);
      }

      minHour = clampHour(minHour - settings.bufferHours);
      maxHour = clampHour(maxHour + settings.bufferHours);

      if (maxHour - minHour < 4) {
        const center = (minHour + maxHour) / 2;
        minHour = clampHour(Math.floor(center - 2));
        maxHour = clampHour(Math.ceil(center + 2));
      }

      return allHours.filter((hour) => hour >= minHour && hour <= maxHour);
    }

    return allHours;
  }, [settings.enabled, settings.mode, settings.startHour, settings.endHour, settings.bufferHours]);

  return {
    settings,
    loaded,
    setSettings,
    toggleHidden,
    setTimeRange,
    getVisibleHours,
  };
}
