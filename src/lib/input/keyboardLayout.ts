/**
 * Geometry of the on-screen keyboard, and the scrolling that keeps the field
 * being typed into visible above it (#499).
 *
 * The keyboard is a fixed overlay, so the browser knows nothing about it: it
 * neither shrinks the viewport nor scrolls the focused field into view the way
 * it does for the OS keyboard. That is done here instead.
 */

/** Keyboard height as a share of the viewport, clamped to MIN..MAX pixels. */
export const KEYBOARD_HEIGHT_VH = 38;
export const KEYBOARD_MIN_HEIGHT_PX = 320;
export const KEYBOARD_MAX_HEIGHT_PX = 480;

/** Gap left between the bottom of the field and the top of the keyboard. */
export const REVEAL_MARGIN_PX = 16;

/** The rendered keyboard height for a viewport of the given height. */
export function keyboardHeightPx(viewportHeight: number): number {
  const h = (viewportHeight * KEYBOARD_HEIGHT_VH) / 100;
  return Math.min(KEYBOARD_MAX_HEIGHT_PX, Math.max(KEYBOARD_MIN_HEIGHT_PX, h));
}

/** What reveal changed on one scroller, so it can be put back. */
export type RevealRecord = {
  scroller: Element;
  scrollTop: number;
  /** Element whose padding-bottom was extended, and its inline value before. */
  padded: HTMLElement | null;
  paddingBefore: string;
};

function scrollsVertically(style: CSSStyleDeclaration): boolean {
  return style.overflowY === 'auto' || style.overflowY === 'scroll';
}

/**
 * Give `scroller` at least `need` px of room below its current scroll
 * position, by extending `padEl`'s bottom padding when the content ends too
 * soon. A field in the last row of a full-height page otherwise has nowhere
 * to scroll to.
 */
function ensureRoom(scroller: Element, padEl: HTMLElement, need: number, record: RevealRecord) {
  const room = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
  if (room >= need) return;
  const current = parseFloat(getComputedStyle(padEl).paddingBottom) || 0;
  record.padded = padEl;
  record.paddingBefore = padEl.style.paddingBottom;
  let extra = need - room;
  padEl.style.paddingBottom = `${current + extra}px`;
  // When the content was shorter than the scroller, the first part of the new
  // padding only fills the empty space below it and adds no room. Re-measure
  // and top up the difference.
  const shortBy = need - (scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop);
  if (shortBy > 0) {
    extra += shortBy;
    padEl.style.paddingBottom = `${current + extra}px`;
  }
}

/**
 * Scroll `target` so its bottom sits above `keyboardTop` (a viewport y).
 *
 * Walks the scrollable ancestors from the nearest outward, scrolling each by
 * whatever is still needed, and stops at the first `position: fixed` ancestor:
 * a fixed dialog does not move when the page scrolls, so scrolling beyond it
 * would only shift the page behind it. The page itself is scrolled last.
 *
 * Every rect is read before anything scrolls (smooth scrolling is async), and
 * the distance already covered is tracked arithmetically.
 */
export function revealAboveKeyboard(
  target: Element,
  keyboardTop: number,
  behavior: ScrollBehavior = 'smooth',
): RevealRecord[] {
  const records: RevealRecord[] = [];
  const targetBottom = target.getBoundingClientRect().bottom;
  let moved = 0;
  let stoppedAtFixed = false;

  for (let node = target.parentElement; node; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) break;
    const style = getComputedStyle(node);
    if (scrollsVertically(style)) {
      const visibleBottom = Math.min(keyboardTop, node.getBoundingClientRect().bottom);
      const need = Math.ceil(targetBottom - moved + REVEAL_MARGIN_PX - visibleBottom);
      if (need > 0) {
        const record: RevealRecord = {
          scroller: node, scrollTop: node.scrollTop, padded: null, paddingBefore: '',
        };
        ensureRoom(node, node, need, record);
        node.scrollBy({ top: need, behavior });
        records.push(record);
        moved += need;
      }
    }
    if (style.position === 'fixed') { stoppedAtFixed = true; break; }
  }

  if (!stoppedAtFixed) {
    const need = Math.ceil(targetBottom - moved + REVEAL_MARGIN_PX - keyboardTop);
    if (need > 0) {
      const page = document.scrollingElement ?? document.documentElement;
      const record: RevealRecord = {
        scroller: page, scrollTop: page.scrollTop, padded: null, paddingBefore: '',
      };
      ensureRoom(page, document.body, need, record);
      window.scrollBy({ top: need, behavior });
      records.push(record);
    }
  }

  return records;
}

/**
 * Undo `revealAboveKeyboard`: drop the added padding and, when
 * `restorePosition` is set, scroll each scroller back to where it was.
 */
export function restoreReveal(records: RevealRecord[], restorePosition: boolean): void {
  for (const r of [...records].reverse()) {
    if (r.padded) r.padded.style.paddingBottom = r.paddingBefore;
    if (!restorePosition) continue;
    if (r.scroller === (document.scrollingElement ?? document.documentElement)) {
      window.scrollTo({ top: r.scrollTop, behavior: 'smooth' });
    } else {
      r.scroller.scrollTo({ top: r.scrollTop, behavior: 'smooth' });
    }
  }
}
