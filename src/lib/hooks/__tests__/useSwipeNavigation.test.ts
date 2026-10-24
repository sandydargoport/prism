/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import { useSwipeNavigation } from '../useSwipeNavigation';

// Store callbacks so tests can verify them
let onSwipeLeftFn: jest.Mock;
let onSwipeRightFn: jest.Mock;
let containerEl: HTMLDivElement | null = null;

function TestComponent({
  threshold,
  enabled,
}: {
  threshold?: number;
  enabled?: boolean;
}) {
  const ref = useSwipeNavigation<HTMLDivElement>({
    onSwipeLeft: onSwipeLeftFn,
    onSwipeRight: onSwipeRightFn,
    threshold,
    enabled,
  });

  // The hook's ref goes on the element as an app would use it; the tests read
  // the element back once it is attached.
  React.useEffect(() => { containerEl = ref.current; });

  return React.createElement('div', {
    ref,
    'data-testid': 'swipe-container',
  });
}

function simulateSwipe(el: HTMLElement, startX: number, startY: number, endX: number, endY: number) {
  el.dispatchEvent(new TouchEvent('touchstart', {
    bubbles: true,
    touches: [
      { clientX: startX, clientY: startY, identifier: 0, target: el } as unknown as Touch,
    ],
  }));

  el.dispatchEvent(new TouchEvent('touchend', {
    bubbles: true,
    changedTouches: [
      { clientX: endX, clientY: endY, identifier: 0, target: el } as unknown as Touch,
    ],
  }));
}

describe('useSwipeNavigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    onSwipeLeftFn = jest.fn();
    onSwipeRightFn = jest.fn();
    containerEl = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls onSwipeLeft for a fast leftward swipe exceeding threshold', () => {
    render(React.createElement(TestComponent, { threshold: 50 }));

    expect(containerEl).not.toBeNull();
    simulateSwipe(containerEl!, 200, 100, 100, 105);

    expect(onSwipeLeftFn).toHaveBeenCalledTimes(1);
    expect(onSwipeRightFn).not.toHaveBeenCalled();
  });

  it('calls onSwipeRight for a fast rightward swipe exceeding threshold', () => {
    render(React.createElement(TestComponent, { threshold: 50 }));

    simulateSwipe(containerEl!, 100, 100, 250, 105);

    expect(onSwipeRightFn).toHaveBeenCalledTimes(1);
    expect(onSwipeLeftFn).not.toHaveBeenCalled();
  });

  it('ignores swipe that takes too long (> 500ms)', () => {
    render(React.createElement(TestComponent, { threshold: 50 }));

    containerEl!.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true,
      touches: [
        { clientX: 200, clientY: 100, identifier: 0, target: containerEl } as unknown as Touch,
      ],
    }));

    jest.advanceTimersByTime(600);

    containerEl!.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true,
      changedTouches: [
        { clientX: 50, clientY: 100, identifier: 0, target: containerEl } as unknown as Touch,
      ],
    }));

    expect(onSwipeLeftFn).not.toHaveBeenCalled();
  });

  it('ignores swipe below threshold', () => {
    render(React.createElement(TestComponent, { threshold: 50 }));

    simulateSwipe(containerEl!, 200, 100, 170, 100); // only 30px

    expect(onSwipeLeftFn).not.toHaveBeenCalled();
  });

  it('ignores vertical swipe (deltaY > deltaX)', () => {
    render(React.createElement(TestComponent, { threshold: 50 }));

    simulateSwipe(containerEl!, 200, 100, 140, 250); // 60px horizontal, 150px vertical

    expect(onSwipeLeftFn).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    render(React.createElement(TestComponent, { threshold: 50, enabled: false }));

    simulateSwipe(containerEl!, 200, 100, 50, 100);

    expect(onSwipeLeftFn).not.toHaveBeenCalled();
  });

  it('uses default threshold of 50 when not specified', () => {
    render(React.createElement(TestComponent, {}));

    // 49px swipe — should be ignored
    simulateSwipe(containerEl!, 200, 100, 151, 100);
    expect(onSwipeLeftFn).not.toHaveBeenCalled();

    // 51px swipe — should trigger
    simulateSwipe(containerEl!, 200, 100, 149, 100);
    expect(onSwipeLeftFn).toHaveBeenCalledTimes(1);
  });
});
