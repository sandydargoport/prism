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
  /** Elements pushed off the right edge, worst first (max 8). */
  overflowers: Overflower[];
  /** True when the fixed side/portrait nav is clipped or spills the viewport. */
  navClipped: boolean;
  navDetail: string | null;
}

/** Runs in the browser. `tolerance` is the px slack before flagging. */
export function layoutProbe(tolerance: number): LayoutProbeResult {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const doc = document.documentElement;
  const pageOverflowX = Math.max(0, doc.scrollWidth - vw);

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

  return {
    viewportW: vw,
    viewportH: vh,
    pageOverflowX: Math.round(pageOverflowX),
    overflowers: overflowers.slice(0, 8),
    navClipped,
    navDetail,
  };
}

export type Severity = 'high' | 'medium' | 'ok';

/** Collapse a probe result into a single severity + human summary. */
export function gradeProbe(p: LayoutProbeResult): { severity: Severity; summary: string } {
  if (p.navClipped) return { severity: 'high', summary: p.navDetail || 'navigation clipped' };
  if (p.pageOverflowX > 4)
    return { severity: 'high', summary: `page scrolls horizontally by ${p.pageOverflowX}px` };
  const worst = p.overflowers[0];
  if (worst)
    return {
      severity: 'medium',
      summary: `${p.overflowers.length} element(s) overhang the right edge (worst: ${worst.desc} by ${worst.overflow}px)`,
    };
  return { severity: 'ok', summary: 'no layout overflow detected' };
}
