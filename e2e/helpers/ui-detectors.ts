/**
 * In-page layout detectors for the UI audit rig (e2e/ui-audit.spec.ts).
 *
 * `layoutProbe` is intentionally SELF-CONTAINED — it is serialized and run
 * inside the browser via `page.evaluate`, so it may reference only browser
 * globals and its single argument (no imports, no closures). It measures the
 * *rendered* layout, so it sees the effect of the display-scale `zoom` wrapper
 * exactly as a user would.
 */

export interface Overflower {
  desc: string;
  right: number;
  overflow: number;
  w: number;
  h: number;
}

export interface LayoutProbeResult {
  viewportW: number;
  viewportH: number;
  /** Horizontal pixels the document scrolls beyond the viewport (0 = none). */
  pageOverflowX: number;
  /**
   * Vertical pixels the document scrolls beyond the viewport (0 = none).
   *
   * Reported, not graded: most routes scroll vertically by design. It matters
   * on the dashboard, which is built to fit exactly — a display scale that
   * grows this proportionally means the bottom of the board is off the screen
   * on a display nobody can scroll.
   */
  pageOverflowY: number;
  /** Elements pushed off the right edge, worst first (max 8). */
  overflowers: Overflower[];
  /** True when the fixed side/portrait nav is clipped or spills the viewport. */
  navClipped: boolean;
  navDetail: string | null;
  /**
   * Widgets hiding content inside their own box, worst first.
   *
   * The rig could not see this class of problem at all. Its detectors looked
   * for things spilling the viewport, but a widget shell carries
   * `overflow-hidden` on both the frame and the content region, so content that
   * outgrows its cell does not spill — it silently disappears. That is the
   * failure mode when text size goes up: the board still looks tidy, with rows
   * missing from the bottom of a widget and nothing to say so.
   */
  clippedWidgets: ClippedWidget[];
}

export interface ClippedWidget {
  /** The widget's `data-widget` value — its type, or its title as a fallback. */
  widget: string;
  /** Vertical pixels of content the widget is hiding. */
  hiddenY: number;
  /** Height of the box doing the clipping, for scale. */
  boxH: number;
}

/** Runs in the browser. `tolerance` is the px slack before flagging. */
export function layoutProbe(tolerance: number): LayoutProbeResult {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  const pageOverflowX = Math.max(0, doc.scrollWidth - vw);
  const pageOverflowY = Math.max(0, doc.scrollHeight - vh);

  const describe = (el: Element): string => {
    const e = el as HTMLElement;
    const id = e.id ? `#${e.id}` : '';
    const cls =
      typeof e.className === 'string'
        ? e.className
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 3)
            .map((c) => `.${c}`)
            .join('')
        : '';
    const widget = e.getAttribute('data-widget');
    return `${el.tagName.toLowerCase()}${id}${cls}${widget ? `[data-widget="${widget}"]` : ''}`;
  };

  // An element inside a horizontal scroller (a carousel, a horizontally
  // scrolled nav/board) legitimately extends past the viewport — that's
  // intentional, not a layout bug. Skip anything under an overflow-x
  // auto/scroll ancestor.
  const inHorizontalScroller = (el: HTMLElement): boolean => {
    let n = el.parentElement;
    while (n && n !== document.body) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
      n = n.parentElement;
    }
    return false;
  };

  const overflowers: Overflower[] = [];
  for (const el of Array.from(document.body.querySelectorAll('*')) as HTMLElement[]) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const over = r.right - vw;
    // Flag elements pushed partly off the right edge — but skip giant
    // containers wider than the viewport (they scroll internally by design)
    // and anything inside an intentional horizontal scroller.
    if (over > tolerance && r.width <= vw + tolerance && !inHorizontalScroller(el)) {
      overflowers.push({
        desc: describe(el),
        right: Math.round(r.right),
        overflow: Math.round(over),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
  }
  overflowers.sort((a, b) => b.overflow - a.overflow);

  let navClipped = false;
  let navDetail: string | null = null;
  const aside = document.querySelector('aside');
  if (aside) {
    const scroller = aside.querySelector('nav');
    if (scroller && scroller.scrollHeight - scroller.clientHeight > tolerance) {
      navClipped = true;
      navDetail = `side-nav list clipped: ${scroller.scrollHeight}px of items in a ${scroller.clientHeight}px rail`;
    }
    const r = aside.getBoundingClientRect();
    if (r.bottom - vh > tolerance || r.right - vw > tolerance) {
      navClipped = true;
      navDetail =
        (navDetail ? navDetail + '; ' : '') +
        `nav spills viewport (bottom ${Math.round(r.bottom)}/${vh}, right ${Math.round(r.right)}/${vw})`;
    }
  }

  // Content clipped INSIDE a widget, rather than spilling out of it.
  //
  // Reported against the innermost `data-widget` element: the grid cell and the
  // widget shell both carry the attribute, and the inner one is named for the
  // widget type rather than its layout id, which is what a punch-list needs.
  const clippedWidgets: ClippedWidget[] = [];
  for (const host of Array.from(document.querySelectorAll('[data-widget]'))) {
    if (host.querySelector('[data-widget]')) continue;
    let hiddenY = 0;
    let boxH = 0;
    for (const el of [host, ...Array.from(host.querySelectorAll('*'))]) {
      const cs = window.getComputedStyle(el);
      if (cs.overflowY !== 'hidden' && cs.overflow !== 'hidden') continue;
      const hidden = el.scrollHeight - el.clientHeight;
      if (hidden > tolerance && hidden > hiddenY) {
        hiddenY = hidden;
        boxH = el.clientHeight;
      }
    }
    if (hiddenY > 0) {
      clippedWidgets.push({
        widget: host.getAttribute('data-widget') || '(unnamed)',
        hiddenY: Math.round(hiddenY),
        boxH: Math.round(boxH),
      });
    }
  }
  clippedWidgets.sort((a, b) => b.hiddenY - a.hiddenY);

  return {
    viewportW: vw,
    viewportH: vh,
    pageOverflowX: Math.round(pageOverflowX),
    pageOverflowY: Math.round(pageOverflowY),
    overflowers: overflowers.slice(0, 8),
    navClipped,
    navDetail,
    clippedWidgets,
  };
}

export type Severity = 'high' | 'medium' | 'ok';

/** Collapse a probe result into a single severity + human summary. */
export function gradeProbe(p: LayoutProbeResult): { severity: Severity; summary: string } {
  if (p.navClipped) return { severity: 'high', summary: p.navDetail || 'navigation clipped' };
  if (p.pageOverflowX > 4)
    return { severity: 'high', summary: `page scrolls horizontally by ${p.pageOverflowX}px` };
  // Ranked above a right-edge overhang: an element sticking out is visible and
  // someone will report it. Content cut off inside a widget looks like the
  // widget simply had less to show, so it is never reported at all.
  const clip = p.clippedWidgets[0];
  if (clip)
    return {
      severity: 'medium',
      summary:
        `${p.clippedWidgets.length} widget(s) hiding content ` +
        `(worst: ${clip.widget}, ${clip.hiddenY}px cut from a ${clip.boxH}px box)`,
    };
  const worst = p.overflowers[0];
  if (worst)
    return {
      severity: 'medium',
      summary: `${p.overflowers.length} element(s) overhang the right edge (worst: ${worst.desc} by ${worst.overflow}px)`,
    };
  return { severity: 'ok', summary: 'no layout overflow detected' };
}
