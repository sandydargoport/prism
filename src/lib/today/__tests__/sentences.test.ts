/**
 * The coming days as sentences (#805).
 */
import { comingDays, SENTENCES, type SentenceEvent } from '../sentences';

const time = (d: Date) => (d.getMinutes() ? `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getHours() % 12 || 12}`);
const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m);
const ev = (title: string, start: Date, who?: string, allDay = false): SentenceEvent => ({ title, start, who, allDay });
const en = { locale: 'en' as const, time };

describe('comingDays', () => {
  it('says nothing for days with nothing on', () => {
    expect(comingDays([{ label: 'Friday', events: [] }, { label: 'Saturday', events: [] }], en)).toEqual({ lines: [] });
  });

  it('says one thing with the person and the time', () => {
    const r = comingDays([{ label: 'Friday', events: [ev('the dentist', at(6, 9), 'Alex')] }], en);
    expect(r.lines).toEqual([{ day: 'Tomorrow', sentence: 'Alex has the dentist at 9.' }]);
  });

  it('joins two things, and leaves out a name the calendar does not have', () => {
    const r = comingDays([{ label: 'Friday', events: [ev('the dentist', at(6, 9), 'Alex'), ev('Piano recital', at(6, 18, 30))] }], en);
    expect(r.lines[0]!.sentence).toBe('Alex has the dentist at 9 and Piano recital at 6:30.');
  });

  it('says what fits and leaves the rest out, with no count (#993)', () => {
    const many = [ev('A', at(6, 9)), ev('B', at(6, 10)), ev('C', at(6, 11))];
    const r = comingDays([
      { label: 'Friday', events: many },
      { label: 'Saturday', events: [ev('Soccer', at(7, 10))] },
      { label: 'Sunday', events: [] },
      { label: 'Monday', events: [ev('Library', at(9, 16))] },
    ], { ...en, daysAhead: 3 });
    expect(r.lines.map((l) => l.day)).toEqual(['Tomorrow', 'Saturday']);
    expect(r.lines[0]!.sentence).toBe('A at 9 and B at 10.');
    expect(r).toEqual({ lines: r.lines });
    expect(JSON.stringify(r)).not.toMatch(/more/i);
  });

  it('does not repeat a name the title already has', () => {
    const r = comingDays([{ label: 'Friday', events: [ev('Alex dentist', at(6, 9), 'Alex')] }], en);
    expect(r.lines[0]!.sentence).toBe('Alex dentist at 9.');
  });

  it('says an all-day event without a time', () => {
    const r = comingDays([{ label: 'Friday', events: [ev('Grandparents visiting', at(6, 0), undefined, true)] }], en);
    expect(r.lines[0]!.sentence).toBe('Grandparents visiting.');
  });

  it('speaks German', () => {
    const r = comingDays([
      { label: 'Freitag', events: [ev('Zahnarzt', at(6, 9), 'Alex'), ev('A', at(6, 10)), ev('B', at(6, 11))] },
      { label: 'Samstag', events: [ev('Fußball', at(7, 10))] },
    ], { locale: 'de', time: (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` });
    expect(r.lines[0]).toEqual({ day: 'Morgen', sentence: 'Alex hat Zahnarzt um 9:00 und A um 10:00.' });
    expect(r.lines[1]).toEqual({ day: 'Samstag', sentence: 'Fußball um 10:00.' });
    expect(r).toEqual({ lines: r.lines });
  });

  it('defaults to three days ahead', () => {
    expect(SENTENCES.daysAheadDefault).toBe(3);
  });
});
