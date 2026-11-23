/**
 * @jest-environment jsdom
 *
 * The one-time What's new note (#1032), with this release's list (#1308):
 * what is new and where to find it, a link to the full changelog in a new
 * tab, and no claim that nothing was removed.
 */
import { render, act, within } from '@testing-library/react';
import { WhatsNew } from '../WhatsNew';
import { WHATS_NEW, WHATS_NEW_SEEN_KEY } from '@/lib/whatsNew';

function openNote() {
  jest.useFakeTimers();
  render(<WhatsNew />);
  // It opens a beat after the page settles.
  act(() => { jest.advanceTimersByTime(600); });
  const note = document.querySelector<HTMLElement>('[data-whats-new]');
  expect(note).not.toBeNull();
  return note!;
}

beforeEach(() => localStorage.clear());
afterEach(() => jest.useRealTimers());

describe("What's new note (#1308)", () => {
  it('names the release and lists what is new, each with its bold lead', () => {
    const note = openNote();
    expect(within(note).getByRole('heading').textContent).toBe("What's new in Prism");
    const items = [...note.querySelectorAll('[data-whats-new-list] li')];
    expect(items).toHaveLength(7);
    expect(items[0]!.querySelector('.font-semibold')!.textContent).toBe('Glance, a new front page layout.');
    expect(items[0]!.textContent).toContain('More > Edit layout > Dashboard > Glance');
    expect(note.textContent).toContain('More > Settings > Screens > Edit');
    expect(note.textContent).toContain('alphanumeric PINs');
    // Two bold runs in one item, and no stray markers left in the text.
    expect([...items[5]!.querySelectorAll('.font-semibold')].map((b) => b.textContent)).toEqual(['Chores for pets', 'subtasks']);
    expect(note.textContent).not.toContain('**');
  });

  it('links to the full changelog in a new tab, and says the list stays in Help', () => {
    const note = openNote();
    const link = within(note).getByRole('link', { name: 'See everything that changed' });
    expect(link.getAttribute('href')).toBe('https://sandydargoport.github.io/prism/CHANGELOG/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toMatch(/\bnoopener\b/);
    expect(note.textContent).toContain('This list stays in More > Help.');
  });

  it('no longer says nothing was removed', () => {
    const note = openNote();
    expect(note.textContent).not.toMatch(/Nothing was removed/i);
  });

  it('shows again on a screen that saw the earlier list', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, '2026-11-new-look');
    openNote();
  });

  it('stays away on a screen that saw this list', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, WHATS_NEW.id);
    jest.useFakeTimers();
    render(<WhatsNew />);
    act(() => { jest.advanceTimersByTime(600); });
    expect(document.querySelector('[data-whats-new]')).toBeNull();
  });
});
