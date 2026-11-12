/**
 * @jest-environment jsdom
 */
/**
 * The live dashboard fills its widgets in a few at a time (#1083): every
 * card's frame at once, the contents two by two, top-left first, each step in
 * its own task. On a slow wall tablet the whole dashboard used to build in one
 * long task that a tap had to wait behind.
 */
import React from 'react';
import { act, render } from '@testing-library/react';
import { CssGridDisplay, STAGE_FIRST, STAGE_STEP } from '../CssGridDisplay';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

// Listed out of reading order on purpose: staging follows the wall, not the list.
const layout = [
  { i: 'd', x: 6, y: 4, w: 6, h: 4 },
  { i: 'a', x: 0, y: 0, w: 6, h: 4 },
  { i: 'e', x: 0, y: 8, w: 12, h: 4 },
  { i: 'c', x: 0, y: 4, w: 6, h: 4 },
  { i: 'b', x: 6, y: 0, w: 6, h: 4 },
] as WidgetConfig[];

const shown = (c: HTMLElement) => [...c.querySelectorAll('[data-content]')].map((e) => e.getAttribute('data-content')).sort();
const frames = (c: HTMLElement) => c.querySelectorAll('[data-widget]').length;

describe('staged dashboard', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows every frame at once and the contents a few at a time, top-left first', () => {
    const { container } = render(<CssGridDisplay staged layout={layout} renderWidget={(w) => <span data-content={w.i} />} />);
    expect(frames(container)).toBe(5);
    expect(STAGE_FIRST).toBe(2);
    expect(shown(container)).toEqual(['a', 'b']);
    act(() => { jest.advanceTimersByTime(0); });
    expect(shown(container)).toHaveLength(STAGE_FIRST + STAGE_STEP);
    expect(shown(container)).toEqual(['a', 'b', 'c', 'd']);
    act(() => { jest.runAllTimers(); });
    expect(shown(container)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('renders everything in one go when not staged (editor, screensaver)', () => {
    const { container } = render(<CssGridDisplay layout={layout} renderWidget={(w) => <span data-content={w.i} />} />);
    expect(shown(container)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
