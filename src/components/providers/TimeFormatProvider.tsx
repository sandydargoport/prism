'use client';

import * as React from 'react';
import {
  DEFAULT_TIME_FORMAT,
  isTimeFormat,
  type TimeFormat,
} from '@/lib/utils/timeFormat';

const SETTING_KEY = 'timeFormat';

interface TimeFormatContextValue {
  timeFormat: TimeFormat;
  setTimeFormat: (next: TimeFormat) => Promise<void>;
}

const TimeFormatContext = React.createContext<TimeFormatContextValue | undefined>(undefined);

export function TimeFormatProvider({ children }: { children: React.ReactNode }) {
  const [timeFormat, setTimeFormatState] = React.useState<TimeFormat>(DEFAULT_TIME_FORMAT);

  React.useEffect(() => {
    let active = true;
    fetch('/api/settings')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const saved = data?.settings?.[SETTING_KEY];
        if (active && isTimeFormat(saved)) setTimeFormatState(saved);
      })
      .catch(() => {});

    return () => { active = false; };
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

  const value = React.useMemo(
    () => ({ timeFormat, setTimeFormat }),
    [timeFormat, setTimeFormat],
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
