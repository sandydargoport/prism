/**
 * @jest-environment jsdom
 */

/**
 * The shared press-and-hold touch drag used by meals and shopping lists.
 * The meal-specific behaviour has its own tests (useMealTouchDrag.test.tsx).
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { useLongPressDrag, TOUCH_DRAG_DELAY_MS } from '../useLongPressDrag';

const handlers = { onStart: jest.fn(), onMove: jest.fn(), onDrop: jest.fn(), onEnd: jest.fn() };

function Card({ enabled = true }: { enabled?: boolean }) {
  const { ref, dragging } = useLongPressDrag<HTMLDivElement>(handlers, { enabled });
  return (
    <div data-testid="card" data-dragging={String(dragging)} ref={ref}>
      <span data-testid="label">Produce</span>
      <input data-testid="field" />
    </div>
  );
}

function touch(el: Element, type: string, x: number, y: number) {
  const point = { clientX: x, clientY: y, identifier: 0, target: el };
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
  Object.defineProperty(ev, 'touches', { value: type === 'touchend' ? [] : [point] });
  Object.defineProperty(ev, 'changedTouches', { value: [point] });
  act(() => { el.dispatchEvent(ev); });
  return ev;
}

const hold = () => act(() => { jest.advanceTimersByTime(TOUCH_DRAG_DELAY_MS + 10); });

describe('useLongPressDrag', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.values(handlers).forEach((h) => h.mockReset());
  });
  afterEach(() => jest.useRealTimers());

  it('starts after the hold, prevents scroll while moving, and drops where it lifts', () => {
    const { getByTestId } = render(<Card />);
    const label = getByTestId('label');
    touch(label, 'touchstart', 10, 10);
    hold();
    expect(handlers.onStart).toHaveBeenCalledTimes(1);
    expect(getByTestId('card').dataset.dragging).toBe('true');
    const move = touch(label, 'touchmove', 40, 60);
    expect(move.defaultPrevented).toBe(true);
    expect(handlers.onMove).toHaveBeenLastCalledWith(40, 60);
    touch(label, 'touchend', 40, 60);
    expect(handlers.onDrop).toHaveBeenCalledWith(40, 60);
    expect(handlers.onEnd).toHaveBeenCalledTimes(1);
  });

  it('a move before the hold is a scroll: nothing starts or is prevented', () => {
    const { getByTestId } = render(<Card />);
    const label = getByTestId('label');
    touch(label, 'touchstart', 10, 10);
    const move = touch(label, 'touchmove', 10, 40);
    hold();
    expect(move.defaultPrevented).toBe(false);
    expect(handlers.onStart).not.toHaveBeenCalled();
  });

  it('never starts from a text field, so typing and selection are untouched', () => {
    const { getByTestId } = render(<Card />);
    touch(getByTestId('field'), 'touchstart', 10, 10);
    hold();
    expect(handlers.onStart).not.toHaveBeenCalled();
  });

  it('touchcancel ends a live drag without a drop', () => {
    const { getByTestId } = render(<Card />);
    const label = getByTestId('label');
    touch(label, 'touchstart', 10, 10);
    hold();
    touch(label, 'touchcancel', 10, 10);
    expect(handlers.onDrop).not.toHaveBeenCalled();
    expect(handlers.onEnd).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', () => {
    const { getByTestId } = render(<Card enabled={false} />);
    touch(getByTestId('label'), 'touchstart', 10, 10);
    hold();
    expect(handlers.onStart).not.toHaveBeenCalled();
  });
});
