'use client';

/**
 * App UI language provider (i18n).
 *
 * Client-side, settings-driven — mirrors TimeFormatProvider: reads the saved
 * `locale` from /api/settings (default English), and exposes setLocale() which
 * persists it. Wraps the tree in next-intl's provider so any component can call
 * useTranslations()/useLocale(). English is the fallback for any missing key.
 *
 * PoC scope: both catalogs are bundled and selected in-memory. A production
 * build would code-split per locale, but for a family dashboard with a handful
 * of Latin-script languages the whole catalog is small enough to ship together.
 */
import * as React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/i18n/messages/en.json';
import de from '@/i18n/messages/de.json';

const MESSAGES = { en, de } as const;
export type AppLocale = keyof typeof MESSAGES;
export const APP_LOCALES: { value: AppLocale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
];

const DEFAULT_LOCALE: AppLocale = 'en';
const SETTING_KEY = 'locale';

function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && value in MESSAGES;
}

/** Deep-merge so any key missing in a non-English catalog falls back to English. */
type Messages = Record<string, unknown>;
function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      existing && typeof existing === 'object' && !Array.isArray(existing)
    ) {
      out[key] = deepMerge(existing as Messages, value as Messages);
    } else {
      out[key] = value;
    }
  }
  return out;
}

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (next: AppLocale) => Promise<void>;
}

const LocaleContext = React.createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<AppLocale>(DEFAULT_LOCALE);

  React.useEffect(() => {
    let active = true;
    fetch('/api/settings')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const saved = data?.settings?.[SETTING_KEY];
        if (active && isAppLocale(saved)) setLocaleState(saved);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setLocale = React.useCallback(
    async (next: AppLocale) => {
      const previous = locale;
      setLocaleState(next);
      try {
        const response = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: SETTING_KEY, value: next }),
        });
        if (!response.ok) throw new Error('Failed to save language');
      } catch (error) {
        setLocaleState(previous);
        throw error;
      }
    },
    [locale],
  );

  const value = React.useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  // English as the base, active locale overlaid → missing translations show English.
  const messages = React.useMemo(
    () => (locale === 'en' ? en : deepMerge(en as Messages, MESSAGES[locale] as Messages)),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useAppLocale(): LocaleContextValue {
  const context = React.useContext(LocaleContext);
  if (!context) throw new Error('useAppLocale must be used within a LocaleProvider');
  return context;
}
