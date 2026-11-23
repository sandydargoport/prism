/**
 * @jest-environment jsdom
 */
/**
 * A chore for a pet (#856) stays on the Do list once it is done today, under
 * "Pets, done today", saying who did it and when, so nobody feeds the dog
 * twice. Any other chore done today leaves the list (#1051).
 */
import { render, screen, within } from '@testing-library/react';
import { ChoresDoList, choreGroups } from '../ChoresDoList';
import { petTickLine } from '@/lib/utils/reminders';
import type { Chore } from '@/types';

const today = new Date(2026, 10, 12, 18, 0);
const at = (h: number, m: number) => new Date(2026, 10, 12, h, m).toISOString();
const biscuit = { id: 'p1', name: 'Biscuit', color: '#d97706' };
const emma = { name: 'Emma', color: '#10b981' };
const jordan = { name: 'Jordan', color: '#ec4899' };

const chore = (over: Partial<Chore>): Chore => ({
  id: 'c', title: 'Chore', category: 'other', frequency: 'daily', enabled: true,
  requiresApproval: false, pointValue: 0, createdAt: new Date(2026, 10, 1), nextDue: '2026-11-12', ...over,
} as Chore);

const fedOnce = chore({
  id: 'feed', title: 'Feed Biscuit', category: 'pets', pet: biscuit,
  lastCompleted: new Date(2026, 10, 12, 7, 40), nextDue: '2026-11-13', doneToday: 1,
  todayTicks: [{ at: at(7, 40), by: emma }],
});
const walkTwice = chore({
  id: 'walk', title: 'Walk Biscuit', category: 'pets', pet: biscuit, timesPerDay: 2, doneToday: 1,
  todayTicks: [{ at: at(7, 5), by: jordan }],
});
const dishes = chore({
  id: 'dishes', title: 'Empty dishwasher', category: 'dishes',
  lastCompleted: new Date(2026, 10, 12, 8, 0), nextDue: '2026-11-13',
});

describe('petTickLine', () => {
  it('names who and when, oldest first, on the wall clock', () => {
    expect(petTickLine([{ at: at(7, 40), by: emma }, { at: at(17, 15), by: jordan }])).toBe('Emma 7:40 AM, Jordan 5:15 PM');
    expect(petTickLine(undefined)).toBe('');
  });
});

describe('a chore with no due date (#1329)', () => {
  it('is due now: listed under Due today, not left out', () => {
    const undated = chore({ id: 'plants', title: 'Water the plants', frequency: 'weekly', nextDue: undefined });
    render(<ChoresDoList chores={[undated]} today={today} onTick={jest.fn()} onApprove={jest.fn()} canApprove />);
    const due = document.querySelector('[data-chores-section="today"]') as HTMLElement;
    expect(within(due).getByText('Water the plants')).toBeTruthy();
    expect(screen.queryByText('Nothing to do this week.')).toBeNull();
  });
});

describe('the Do list with pets (#856)', () => {
  it('keeps a pet chore done today, and only a pet chore', () => {
    const g = choreGroups([fedOnce, dishes], today);
    expect(g.petsDone.map((c) => c.id)).toEqual(['feed']);
    expect(g.done.map((c) => c.id).sort()).toEqual(['dishes', 'feed']);
  });

  it('shows it under Pets, done today with who and when, and not as a button', () => {
    render(<ChoresDoList chores={[fedOnce, walkTwice, dishes]} today={today} onTick={jest.fn()} onApprove={jest.fn()} canApprove />);
    const section = document.querySelector('[data-chores-section="pets-done"]') as HTMLElement;
    expect(within(section).getByText('Pets, done today')).toBeTruthy();
    const row = within(section).getByText('Feed Biscuit').closest('[data-list-row]') as HTMLElement;
    expect(row.textContent).toContain('Emma 7:40 AM');
    expect(row.querySelector('button')).toBeNull();
    expect(screen.queryByText('Empty dishwasher')).toBeNull();
  });

  it('says who did the first walk on a chore still due today', () => {
    render(<ChoresDoList chores={[walkTwice]} today={today} onTick={jest.fn()} onApprove={jest.fn()} canApprove />);
    const due = document.querySelector('[data-chores-section="today"]') as HTMLElement;
    expect(within(due).getByText('Walk Biscuit').closest('[data-list-row]')!.textContent).toContain('Jordan 7:05 AM');
    expect(document.querySelector('[data-chores-section="pets-done"]')).toBeNull();
  });
});

/**
 * #1227: Late, the tick times and the Today / Tomorrow sections follow the
 * household's clock, not the device's. CI runs in UTC, so each case puts the
 * household in a zone whose wall clock differs from UTC at that instant.
 */
describe('the Do list on the household clock (#1227)', () => {
  // 19:30 UTC on 12 Nov 2026 is 1:30 PM in Chicago and 4:30 AM on the 13th in Tokyo.
  const evening = new Date(Date.UTC(2026, 10, 12, 19, 30));
  const tablet = chore({ id: 'tablet', title: 'Allergy tablet', kind: 'reminder', nextDue: '2026-11-12', nextDueTime: '19:00' });
  afterEach(() => jest.useRealTimers());
  const lateRows = (timeZone: string, now: Date, chores: Chore[]) => {
    // The page passes today={new Date()}: the system clock and `now` agree.
    jest.useFakeTimers({ now });
    render(<ChoresDoList chores={chores} today={now} timeZone={timeZone} onTick={jest.fn()} onApprove={jest.fn()} canApprove />);
    return [...document.querySelectorAll('[data-chore-late]')].map((el) => el.closest('[data-list-row]')!.textContent);
  };

  it('does not call a 7:00 PM reminder Late at 1:30 PM in a Chicago household', () => {
    expect(lateRows('America/Chicago', evening, [tablet])).toEqual([]);
    expect(screen.getByText('Allergy tablet').closest('[data-list-row]')!.textContent).toContain('7:00 PM');
  });

  it('calls it Late once 7:00 PM has passed there', () => {
    // 7:05 PM in Chicago (CST) is 01:05 UTC on the 13th.
    expect(lateRows('America/Chicago', new Date(Date.UTC(2026, 10, 13, 1, 5)), [tablet])).toHaveLength(1);
  });

  it('calls it Late at 7:30 PM in a Tokyo household, while UTC still reads 10:30 AM', () => {
    expect(lateRows('Asia/Tokyo', new Date(Date.UTC(2026, 10, 12, 10, 30)), [tablet])).toHaveLength(1);
  });

  it('files chores under the household day', () => {
    // 4:30 AM on the 13th in Tokyo: a chore due the 13th is today's, one due the 14th tomorrow's.
    const g = choreGroups([
      chore({ id: 'd13', nextDue: '2026-11-13' }),
      chore({ id: 'd14', nextDue: '2026-11-14' }),
    ], evening, 'Asia/Tokyo');
    expect(g.today.map((c) => c.id)).toEqual(['d13']);
    expect(g.tomorrow.map((c) => c.id)).toEqual(['d14']);
  });

  it('says when a pet was fed on the household clock', () => {
    const tick = { at: new Date(Date.UTC(2026, 10, 12, 13, 40)).toISOString(), by: emma };
    render(<ChoresDoList chores={[{ ...walkTwice, todayTicks: [tick] }]} today={evening} timeZone="America/Chicago"
      onTick={jest.fn()} onApprove={jest.fn()} canApprove />);
    expect(screen.getByText('Walk Biscuit').closest('[data-list-row]')!.textContent).toContain('Emma 7:40 AM');
    expect(petTickLine([tick], 'Asia/Tokyo')).toBe('Emma 10:40 PM');
  });
});
