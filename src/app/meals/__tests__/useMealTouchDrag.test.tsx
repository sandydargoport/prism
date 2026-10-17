/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { useMealTouchDrag, TOUCH_DRAG_DELAY_MS, TOUCH_DRAG_TOLERANCE_PX } from '../useMealTouchDrag';

let onDropMeal: jest.Mock;

function Card() {
  const { ref, dragging } = useMealTouchDrag<HTMLDivElement>('meal-1', onDropMeal);
  return <div data-testid="card" data-dragging={String(dragging)} ref={ref}>Spaghetti</div>;
}

function touch(el: Element, type: string, x: number, y: number) {
  const point = { clientX: x, clientY: y, identifier: 0, target: el };
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
  const list = type === 'touchend' ? [] : [point];
  Object.defineProperty(ev, 'touches', { value: list });
  Object.defineProperty(ev, 'changedTouches', { value: [point] });
  act(() => { el.dispatchEvent(ev); });
  return ev;
}

describe('useMealTouchDrag', () => {
  let tuesdayRow: HTMLDivElement;

  beforeEach(() => {
    jest.useFakeTimers();
    onDropMeal = jest.fn();
    tuesdayRow = document.createElement('div');
    tuesdayRow.setAttribute('data-meal-day', 'tuesday');
    document.body.appendChild(tuesdayRow);
    // jsdom has no layout, so every point resolves to the Tuesday row
    (document as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => [tuesdayRow];
  });

  afterEach(() => {
    jest.useRealTimers();
    tuesdayRow.remove();
  });

  it('uses the same long-press gate as the other touch drag surfaces', () => {
    expect(TOUCH_DRAG_DELAY_MS).toBe(500);
    expect(TOUCH_DRAG_TOLERANCE_PX).toBe(8);
  });

  it('treats a swipe that moves before the delay as a scroll, not a drag', () => {
    const { getByTestId } = render(<Card />);
    const card = getByTestId('card');
    touch(card, 'touchstart', 100, 100);
    const move = touch(card, 'touchmove', 100, 140);
    act(() => { jest.advanceTimersByTime(TOUCH_DRAG_DELAY_MS + 50); });
    touch(card, 'touchend', 100, 300);

    expect(move.defaultPrevented).toBe(false);
    expect(card.dataset.dragging).toBe('false');
    expect(onDropMeal).not.toHaveBeenCalled();
  });

  it('does not grab a meal on a quick move even within the old 10px threshold window', () => {
    const { getByTestId } = render(<Card />);
    const card = getByTestId('card');
    touch(card, 'touchstart', 100, 100);
    touch(card, 'touchmove', 100, 112);
    touch(card, 'touchend', 100, 112);
    expect(onDropMeal).not.toHaveBeenCalled();
  });

  it('picks the meal up after a long press and drops it on the day under the finger', () => {
    const { getByTestId } = render(<Card />);
    const card = getByTestId('card');
    touch(card, 'touchstart', 100, 100);
    touch(card, 'touchmove', 103, 102); // jitter within tolerance
    act(() => { jest.advanceTimersByTime(TOUCH_DRAG_DELAY_MS); });
    expect(card.dataset.dragging).toBe('true');

    const move = touch(card, 'touchmove', 100, 300);
    expect(move.defaultPrevented).toBe(true);
    expect(tuesdayRow.classList.contains('ring-2')).toBe(true);

    touch(card, 'touchend', 100, 300);
    expect(onDropMeal).toHaveBeenCalledWith('meal-1', 'tuesday');
    expect(card.dataset.dragging).toBe('false');
    expect(tuesdayRow.classList.contains('ring-2')).toBe(false);
  });

  it('abandons the drag on touchcancel', () => {
    const { getByTestId } = render(<Card />);
    const card = getByTestId('card');
    touch(card, 'touchstart', 100, 100);
    act(() => { jest.advanceTimersByTime(TOUCH_DRAG_DELAY_MS); });
    touch(card, 'touchcancel', 100, 100);
    touch(card, 'touchend', 100, 300);
    expect(onDropMeal).not.toHaveBeenCalled();
    expect(card.dataset.dragging).toBe('false');
  });
});
