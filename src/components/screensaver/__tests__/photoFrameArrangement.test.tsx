/**
 * @jest-environment jsdom
 */
/**
 * The running photo frame shows the arrangement of the dashboard the screen
 * shows, as saved on that dashboard (#1346). An edit made from another device
 * reaches it without a reload, and the copy a browser kept from v1.30.1 is
 * never read here: only the one-time carry-over reads it.
 */
import { act, render } from '@testing-library/react';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

const drawn: WidgetConfig[][] = [];
jest.mock('@/components/layout/grid/CssGridDisplay', () => ({
  CssGridDisplay: ({ layout }: { layout: WidgetConfig[] }) => {
    drawn.push(layout);
    return null;
  },
}));
jest.mock('@/components/dashboard/useDashboardData', () => ({ useDashboardData: () => ({}) }));
jest.mock('@/components/dashboard/useWidgetProps', () => ({ buildWidgetProps: () => ({}) }));

import { ScreensaverGrid } from '../Screensaver';
import { resetPhotoFrameArrangement, setPhotoFrameArrangement } from '../photoFrameArrangement';

const KEY = 'prism-screensaver-layout';
const main: WidgetConfig[] = [{ i: 'clock', x: 2, y: 2, w: 16, h: 10, visible: true }];
const edited: WidgetConfig[] = [{ i: 'weather', x: 20, y: 14, w: 14, h: 8, visible: true }];
const kept: WidgetConfig[] = [{ i: 'messages', x: 0, y: 0, w: 12, h: 12, visible: true }];

const last = () => drawn[drawn.length - 1];

beforeEach(() => {
  drawn.length = 0;
  localStorage.clear();
  localStorage.setItem('prism-screensaver-motion', 'off');
  localStorage.setItem('prism-screensaver-motion-v2', '1');
  resetPhotoFrameArrangement();
});

describe('the running photo frame', () => {
  it('shows the dashboard\'s arrangement, and an edit saved elsewhere without a reload', () => {
    act(() => { setPhotoFrameArrangement(main); });
    render(<ScreensaverGrid />);
    expect(last()).toEqual(main);

    // The dashboard is fetched again with the edit; the frame stays mounted.
    act(() => { setPhotoFrameArrangement(edited); });
    expect(last()).toEqual(edited);
  });

  it('never reads the arrangement this browser kept', () => {
    localStorage.setItem(KEY, JSON.stringify(kept));
    const read = jest.spyOn(Storage.prototype, 'getItem');
    try {
      act(() => { setPhotoFrameArrangement(main); });
      render(<ScreensaverGrid />);
      expect(last()).toEqual(main);
      expect(read.mock.calls.map(([k]) => k)).not.toContain(KEY);
    } finally {
      read.mockRestore();
    }
  });
});
