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
