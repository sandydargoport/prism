/**
 * @jest-environment jsdom
 */
/**
 * The birthday nudge's Not now (#911) is kept on the screen, as a one-way
 * digest: the browser's storage holds neither which birthday nor its day.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { QuietLines } from '../QuietLines';
import type { BirthdayLike } from '@/lib/today/quietLines';

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'America/Chicago' }),
  useAuth: () => ({ requireAuth: async () => null }),
}));
jest.mock('@/components/ui/use-toast', () => ({ toast: jest.fn() }));

const KEY = 'prism-birthday-nudge-put-off';
// Monday 9 am in Chicago; the birthday is on Friday.
const NOW = new Date('2026-11-23T15:00:00Z');
const ID = 'birthday-grandpa-joe';
const DAY = '2026-11-27';
const grandpa = (nextBirthday = DAY): BirthdayLike =>
  ({ id: ID, name: 'Grandpa Joe', eventType: 'birthday', age: 80, daysUntil: 4, nextBirthday });

const show = (b = grandpa()) => render(<QuietLines chores={[]} lists={[]} birthdays={[b]} now={NOW} />);
const nudge = () => document.querySelector('[data-today-nudge]');
const kept = () => localStorage.getItem(KEY) ?? '';

beforeEach(() => localStorage.clear());

describe('putting off the birthday nudge', () => {
  it('keeps neither the birthday nor its day in storage, and holds after a reload', () => {
    const first = show();
    expect(nudge()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(nudge()).toBeNull();

    expect(JSON.parse(kept())).toHaveLength(1);
    expect(kept()).not.toContain(ID);
    expect(kept()).not.toContain('11-27');

    first.unmount();
    const again = show();
    // Still put off after a reload.
    expect(nudge()).toBeNull();
    again.unmount();

    // Next year's birthday is a new one, so it is offered again.
    show(grandpa('2027-11-27'));
    expect(nudge()).not.toBeNull();
  });

  it('a put-off kept as the birthday and its day still holds, and is encoded when read', () => {
    localStorage.setItem(KEY, JSON.stringify([`${ID}:${DAY}`]));
    show();
    expect(nudge()).toBeNull();
    expect(JSON.parse(kept())).toHaveLength(1);
    expect(kept()).not.toContain(ID);
    expect(kept()).not.toContain('11-27');
  });
});
