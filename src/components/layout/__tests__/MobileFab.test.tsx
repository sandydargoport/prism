/**
 * @jest-environment jsdom
 *
 * The phone's round button (#1354): the page's Add and nothing else. No Add on
 * the page, no button, so the dashboard has none; Home, Settings, Cards,
 * Reorder and Sign in live in the dock and More.
 */
import { act, fireEvent, render } from '@testing-library/react';
import { pageAddStore, usePageAdd } from '@/lib/hooks/usePageAdd';
import { MobileFab } from '../MobileFab';

// On the dashboard. The button once held the dashboard's options there.
jest.mock('next/navigation', () => ({ usePathname: () => '/' }));
jest.mock('@/components/providers/ThemeProvider', () => ({ useTheme: () => ({ theme: 'light', setTheme: () => {} }) }));

function Page({ label, run }: { label: string; run: () => void }) {
  usePageAdd(label, run);
  return null;
}

afterEach(() => { act(() => pageAddStore.set(null)); });

describe('the round button (#1354)', () => {
  it('a page with no Add, the dashboard among them, has no round button and no options', () => {
    const { container } = render(<MobileFab />);
    expect(container.innerHTML).toBe('');
    expect(document.querySelector('[data-mobile-options]')).toBeNull();
    expect(document.querySelector('[data-page-add]')).toBeNull();
  });

  it("on a page with an Add it is that Add, and only that", () => {
    const run = jest.fn();
    render(<><Page label="Add chore" run={run} /><MobileFab /></>);
    const buttons = document.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    const add = document.querySelector<HTMLElement>('[data-page-add]')!;
    expect(add.getAttribute('aria-label')).toBe('Add chore');
    for (const word of ['Home', 'Settings', 'Cards', 'Reorder', 'Login', 'Theme']) expect(document.body.textContent).not.toContain(word);
    fireEvent.click(add);
    expect(run).toHaveBeenCalledTimes(1);
    // Never over an open window.
    expect(add.className).toContain('[body:has([role=dialog])_&]:hidden');
  });
});
