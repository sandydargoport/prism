/**
 * Catalogue contract tests.
 *
 * The Jest `next-intl` mock always resolves against the English catalogue and
 * its provider is a pass-through (see src/test-utils/nextIntlMock.tsx), so no
 * rendering test can observe a German regression. What CAN be checked cheaply
 * is the contract between the code and the catalogues, which is where drift
 * actually happens: an English key added without its translation, or a new
 * provider bucket emitted with no matching entry.
 */
import en from '@/i18n/messages/en.json';
import de from '@/i18n/messages/de.json';
import { wmoDescriptionKey } from '@/lib/integrations/openmeteo';
import { DAYS_SHORT_ARRAY } from '@/lib/constants/days';

type Dict = Record<string, unknown>;

function flatten(obj: Dict, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? flatten(value as Dict, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('i18n catalogues', () => {
  it('German covers every English key, with no orphans', () => {
    const enKeys = flatten(en as Dict).sort();
    const deKeys = flatten(de as Dict).sort();
    expect(deKeys.filter((k) => !enKeys.includes(k))).toEqual([]); // orphaned
    expect(enKeys.filter((k) => !deKeys.includes(k))).toEqual([]); // untranslated
  });

  it('has no empty translations', () => {
    const empties: string[] = [];
    const walk = (obj: Dict, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object') walk(value as Dict, `${prefix}${key}.`);
        else if (typeof value !== 'string' || value.trim() === '') empties.push(`${prefix}${key}`);
      }
    };
    walk(de as Dict);
    expect(empties).toEqual([]);
  });
});

describe('directions to Manage calendars (#1313)', () => {
  // Hidden events are unhidden in Manage calendars, in the Calendar page's
  // View menu; there is no Calendars section in Settings. The path is built
  // from each catalogue's own labels, so a renamed menu fails here too.
  const pathIn = (locale: Dict) => {
    const common = (locale.common as Dict).nav as Dict;
    const calendar = locale.calendar as Dict;
    return [common.calendar, (calendar.options as Dict).trigger, (calendar.toolbar as Dict).manageCalendars].join(' > ');
  };

  it.each([
    ['en', en, 'Calendar > View > Manage calendars'],
    ['de', de, 'Kalender > Ansicht > Kalender verwalten'],
  ] as const)('%s: the Hide in Prism hint and toast name it, not Settings', (_name, locale, path) => {
    expect(pathIn(locale as Dict)).toBe(path);
    const event = (locale.calendar as Dict).event as Dict;
    for (const key of ['hideInPrismHint', 'hiddenToastBody']) {
      expect(event[key]).toContain(path);
      expect(event[key]).not.toMatch(/Settings|Einstellungen/);
    }
  });
});

describe('weather condition keys', () => {
  // Every WMO code the provider can see, including the buckets' edges and the
  // gaps between them that fall through to the default.
  const codes = [0, 1, 2, 3, 45, 48, 51, 55, 61, 65, 71, 75, 80, 82, 85, 86, 95, 99, 56, 66, 77, 4];

  it('every key the provider emits exists in both catalogues', () => {
    const conditions = (locale: Dict) =>
      ((locale.weather as Dict | undefined)?.conditions ?? {}) as Dict;
    for (const code of codes) {
      const key = wmoDescriptionKey(code);
      expect(Object.keys(conditions(en as Dict))).toContain(key);
      expect(Object.keys(conditions(de as Dict))).toContain(key);
    }
  });
});

describe('weekday tokens', () => {
  // WeatherWidget.localizeDayName maps these provider tokens back to an index
  // before localising. If the shape changes, day labels silently stay English.
  it('are the seven short English names the providers emit', () => {
    expect([...DAYS_SHORT_ARRAY]).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });
});
