import { migrateSubpageView, migrateWidgetView } from '../retiredCalendarViews';
import { VIEW_OPTIONS, getAvailableViews } from '@/lib/hooks/useCalendarWidgetPrefs';
import { VIEW_MENU_OPTIONS } from '@/app/calendar/ViewMenu';

describe('migrateSubpageView', () => {
  it('moves 1W to Schedule and 3W/4W to Month', () => {
    expect(migrateSubpageView('multiWeek', '1')).toBe('week');
    expect(migrateSubpageView('multiWeek', '3')).toBe('month');
    expect(migrateSubpageView('multiWeek', '4')).toBe('month');
  });

  it('keeps 2W, with or without a saved count', () => {
    expect(migrateSubpageView('multiWeek', '2')).toBe('multiWeek');
    expect(migrateSubpageView('multiWeek', null)).toBe('multiWeek');
  });

  it('keeps every other view and ignores the count for them', () => {
    for (const v of ['agenda', 'day', 'week', 'weekVertical', 'month', 'threeMonth']) {
      expect(migrateSubpageView(v, '4')).toBe(v);
    }
  });

  it('falls back to Month for nothing saved or an unknown value', () => {
    expect(migrateSubpageView(null, null)).toBe('month');
    expect(migrateSubpageView('fortnight', '2')).toBe('month');
  });
});

describe('migrateWidgetView', () => {
  it('moves 1W to Schedule and 3W/4W to Month', () => {
    expect(migrateWidgetView('multiWeek', null)).toBe('week');
    expect(migrateWidgetView('multiWeek3', null)).toBe('month');
    expect(migrateWidgetView('multiWeek4', null)).toBe('month');
  });

  it('reads the older multiWeek + separate count format', () => {
    expect(migrateWidgetView('multiWeek', '1')).toBe('week');
    expect(migrateWidgetView('multiWeek', '2')).toBe('multiWeek2');
    expect(migrateWidgetView('multiWeek', '3')).toBe('month');
    expect(migrateWidgetView('multiWeek', '4')).toBe('month');
  });

  it('keeps the older twoWeek and list values working', () => {
    expect(migrateWidgetView('twoWeek', null)).toBe('multiWeek2');
    expect(migrateWidgetView('list', null)).toBe('agenda');
  });

  it('keeps every kept view and falls back to Agenda', () => {
    for (const v of ['agenda', 'day', 'week', 'multiWeek2', 'month']) {
      expect(migrateWidgetView(v, null)).toBe(v);
    }
    expect(migrateWidgetView(null, null)).toBe('agenda');
    expect(migrateWidgetView('fortnight', null)).toBe('agenda');
  });
});

describe('views offered', () => {
  it('calendar page dropdown lists the seven kept views, in order', () => {
    expect(VIEW_MENU_OPTIONS.map((o) => o.labelKey)).toEqual(
      ['agenda', 'day', 'list', 'schedule', 'week2', 'month', 'threeMonth'],
    );
  });

  it('calendar widget offers no retired view at any size', () => {
    expect(VIEW_OPTIONS.map((o) => o.value)).toEqual(['agenda', 'day', 'list', 'week', 'multiWeek2', 'month']);
    for (const [w, h] of [[48, 48], [36, 24], [24, 36], [24, 24], [16, 16], [8, 8]] as const) {
      const views: string[] = getAvailableViews(w, h);
      expect(views).not.toEqual(expect.arrayContaining(['multiWeek']));
      expect(views).not.toEqual(expect.arrayContaining(['multiWeek3']));
      expect(views).not.toEqual(expect.arrayContaining(['multiWeek4']));
    }
    expect(getAvailableViews(24, 24)).toEqual(['agenda', 'list', 'day', 'week', 'multiWeek2', 'month']);
  });
});
