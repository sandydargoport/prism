/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

// The mode toggles reach for hooks and the API; here only their markup matters.
jest.mock('@/components/away-mode', () => ({ AwayModeToggle: ({ showLabel, ...p }: { showLabel?: boolean }) => <button data-screen-job="away" title="Enable Away Mode" {...p}>{showLabel ? 'Away' : null}</button> }));
jest.mock('@/components/babysitter-mode', () => ({ BabysitterModeToggle: ({ showLabel, ...p }: { showLabel?: boolean }) => <button data-screen-job="babysitter" title="Enable Babysitter Mode" {...p}>{showLabel ? 'Babysitter' : null}</button> }));
jest.mock('@/components/layout/PerformanceModeBadge', () => ({ PerformanceModeBadge: () => null }));
jest.mock('@/lib/hooks/useAutoHideUI', () => ({ useAutoHideUI: () => ({ uiHidden: false }) }));

import { ScreenJobs } from '../DashboardGrid';

const jobs = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-screen-job]')];

describe('ScreenJobs (#1006)', () => {
  it('as icons, every job carries its name as a tooltip and shows no text', () => {
    const { container } = render(<ScreenJobs onEditClick={() => {}} onScreensaverClick={() => {}} />);
    const all = jobs(container);
    expect(all.map((j) => j.dataset.screenJob)).toEqual(['edit', 'reload', 'babysitter', 'away', 'screensaver']);
    for (const j of all) {
      expect(j.getAttribute('title')).toBeTruthy();
      expect(j.textContent?.trim()).toBe('');
    }
  });

  it('labelled, every job shows its name', () => {
    render(<ScreenJobs labelled onEditClick={() => {}} onScreensaverClick={() => {}} />);
    for (const name of ['Edit layout', 'Reload', 'Babysitter', 'Away', 'Screensaver']) expect(screen.getByText(name)).toBeTruthy();
  });
});
