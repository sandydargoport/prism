/**
 * @jest-environment jsdom
 */
/**
 * Lifting the focused field above the on-screen keyboard (#499). jsdom has no
 * layout, so rects and scroll sizes are stubbed per element.
 */
import {
  keyboardHeightPx,
  restoreReveal,
  revealAboveKeyboard,
  REVEAL_MARGIN_PX,
} from '../keyboardLayout';

function stubRect(el: Element, top: number, bottom: number) {
  el.getBoundingClientRect = () =>
    ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON() {} }) as DOMRect;
}

function stubScroller(el: HTMLElement, { scrollHeight, clientHeight, scrollTop = 0 }: {
  scrollHeight: number; clientHeight: number; scrollTop?: number;
}) {
  el.style.overflowY = 'auto';
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight });
  el.scrollTop = scrollTop;
  el.scrollBy = jest.fn() as unknown as typeof el.scrollBy;
  el.scrollTo = jest.fn() as unknown as typeof el.scrollTo;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.style.paddingBottom = '';
  window.scrollBy = jest.fn();
  window.scrollTo = jest.fn();
});

describe('keyboardHeightPx', () => {
  it('is 38% of the viewport, clamped to 320..480px', () => {
    expect(keyboardHeightPx(1000)).toBe(380);
    expect(keyboardHeightPx(600)).toBe(320);
    expect(keyboardHeightPx(2160)).toBe(480);
  });
});

describe('revealAboveKeyboard', () => {
  it('scrolls the nearest scroller just enough to clear the keyboard', () => {
    const scroller = document.createElement('div');
    const field = document.createElement('input');
    scroller.appendChild(field);
    document.body.appendChild(scroller);
    stubScroller(scroller, { scrollHeight: 2000, clientHeight: 1000 });
    stubRect(scroller, 0, 1000);
    stubRect(field, 800, 830);

    const records = revealAboveKeyboard(field, 600, 'auto');

    expect(scroller.scrollBy).toHaveBeenCalledWith({ top: 830 + REVEAL_MARGIN_PX - 600, behavior: 'auto' });
    expect(window.scrollBy).not.toHaveBeenCalled();
    expect(records).toHaveLength(1);
    expect(scroller.style.paddingBottom).toBe('');
  });

  it('does nothing when the field is already above the keyboard', () => {
    const scroller = document.createElement('div');
    const field = document.createElement('input');
    scroller.appendChild(field);
    document.body.appendChild(scroller);
    stubScroller(scroller, { scrollHeight: 2000, clientHeight: 1000 });
    stubRect(scroller, 0, 1000);
    stubRect(field, 100, 130);

    expect(revealAboveKeyboard(field, 600, 'auto')).toEqual([]);
    expect(scroller.scrollBy).not.toHaveBeenCalled();
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it('adds bottom padding when the content ends too soon to scroll far enough', () => {
    const scroller = document.createElement('div');
    const field = document.createElement('input');
    scroller.appendChild(field);
    document.body.appendChild(scroller);
    // Content fits exactly: no room to scroll at all. Extra padding adds room.
    stubScroller(scroller, { scrollHeight: 1000, clientHeight: 1000 });
    scroller.style.paddingBottom = '8px';
    Object.defineProperty(scroller, 'scrollHeight', {
      configurable: true,
      get: () => 1000 + (parseFloat(scroller.style.paddingBottom) || 0) - 8,
    });
    stubRect(scroller, 0, 1000);
    stubRect(field, 900, 930);

    const records = revealAboveKeyboard(field, 600, 'auto');
    const need = 930 + REVEAL_MARGIN_PX - 600;

    expect(scroller.style.paddingBottom).toBe(`${8 + need}px`);
    expect(scroller.scrollBy).toHaveBeenCalledWith({ top: need, behavior: 'auto' });

    restoreReveal(records, false);
    expect(scroller.style.paddingBottom).toBe('8px');
  });

  it('tops the padding up when the content was shorter than the scroller', () => {
    const scroller = document.createElement('div');
    const field = document.createElement('input');
    scroller.appendChild(field);
    document.body.appendChild(scroller);
    stubScroller(scroller, { scrollHeight: 1000, clientHeight: 1000 });
    // The content ends 40px above the scroller's bottom, so the first 40px of
    // any padding fills that gap and does not add scroll room.
    const contentEnd = 960;
    Object.defineProperty(scroller, 'scrollHeight', {
      configurable: true,
      get: () => Math.max(1000, contentEnd + (parseFloat(scroller.style.paddingBottom) || 0)),
    });
    stubRect(scroller, 0, 1000);
    stubRect(field, 900, 930);

    revealAboveKeyboard(field, 600, 'auto');
    const need = 930 + REVEAL_MARGIN_PX - 600;

    expect(scroller.scrollHeight - scroller.clientHeight).toBeGreaterThanOrEqual(need);
  });

  it('stops at a fixed ancestor: a dialog does not move when the page scrolls', () => {
    const dialog = document.createElement('div');
    dialog.style.position = 'fixed';
    const field = document.createElement('input');
    dialog.appendChild(field);
    document.body.appendChild(dialog);
    stubScroller(dialog, { scrollHeight: 900, clientHeight: 500 });
    stubRect(dialog, 50, 550);
    stubRect(field, 600, 630); // below the dialog's visible bottom

    revealAboveKeyboard(field, 700, 'auto');

    // Scrolled inside the dialog to its own visible bottom (550), not to the
    // keyboard top, and the page behind it is left alone.
    expect(dialog.scrollBy).toHaveBeenCalledWith({ top: 630 + REVEAL_MARGIN_PX - 550, behavior: 'auto' });
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it('falls back to scrolling the page when no ancestor scrolls', () => {
    const field = document.createElement('input');
    document.body.appendChild(field);
    stubRect(field, 700, 730);

    revealAboveKeyboard(field, 600, 'auto');

    expect(window.scrollBy).toHaveBeenCalledWith({ top: 730 + REVEAL_MARGIN_PX - 600, behavior: 'auto' });
  });
});

describe('restoreReveal', () => {
  it('scrolls each scroller back when asked to', () => {
    const scroller = document.createElement('div');
    const field = document.createElement('input');
    scroller.appendChild(field);
    document.body.appendChild(scroller);
    stubScroller(scroller, { scrollHeight: 2000, clientHeight: 1000, scrollTop: 40 });
    stubRect(scroller, 0, 1000);
    stubRect(field, 800, 830);

    const records = revealAboveKeyboard(field, 600, 'auto');
    restoreReveal(records, true);

    expect(scroller.scrollTo).toHaveBeenCalledWith({ top: 40, behavior: 'smooth' });
  });

  it('leaves the position alone when not asked to', () => {
    const scroller = document.createElement('div');
    const field = document.createElement('input');
    scroller.appendChild(field);
    document.body.appendChild(scroller);
    stubScroller(scroller, { scrollHeight: 2000, clientHeight: 1000 });
    stubRect(scroller, 0, 1000);
    stubRect(field, 800, 830);

    restoreReveal(revealAboveKeyboard(field, 600, 'auto'), false);
    expect(scroller.scrollTo).not.toHaveBeenCalled();
  });
});
