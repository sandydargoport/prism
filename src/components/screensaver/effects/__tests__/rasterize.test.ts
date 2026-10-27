/**
 * @jest-environment jsdom
 */
/**
 * The fireworks snapshot has to be the widget as it is on screen, because the
 * burst is made of its pixels. Each case here is a way it once was not: drawn
 * at the wrong size, set in the wrong font, or given outlines the widget does
 * not have. All of them showed as card edges cut off or redrawn mid-burst.
 *
 * jsdom cannot decode an SVG, so these read the document rasterize builds,
 * which is what decides what the snapshot looks like.
 */
import { rasterize } from '../rasterize';

/** The SVG document rasterize hands to the browser. */
async function snapshotSvg(el: HTMLElement): Promise<Document> {
  let src = '';
  // jsdom has no decode at all, so there is nothing to spy on; define one.
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value(this: HTMLImageElement) {
      src = this.src;
      return Promise.reject(new Error('jsdom draws nothing'));
    },
  });
  try {
    await rasterize(el);
  } finally {
    delete (HTMLImageElement.prototype as Partial<HTMLImageElement>).decode;
  }
  expect(src).toMatch(/^data:image\/svg\+xml/);
  const svg = decodeURIComponent(src.slice(src.indexOf(',') + 1));
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

function widget(width: number, height: number, drawnWidth = width, drawnHeight = height) {
  const el = document.createElement('div');
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, x: 0, y: 0, width: drawnWidth, height: drawnHeight,
      right: drawnWidth, bottom: drawnHeight, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('the fireworks snapshot', () => {
  it('is zoomed to the size the widget is drawn at, not the size it is laid out at', async () => {
    // A widget under a 1.25 font scale: laid out 400 wide, drawn 500 wide.
    // Unzoomed, the snapshot filled only the top-left of its box and the
    // burst came apart along a hard edge inside the card.
    const doc = await snapshotSvg(widget(400, 300, 500, 375));
    const svg = doc.documentElement;
    expect(svg.getAttribute('width')).toBe('500');
    const root = svg.querySelector('foreignObject')!.firstElementChild as HTMLElement;
    expect(root.getAttribute('style')).toMatch(/zoom:\s*1\.25/);
  });

  it('is not zoomed at all when there is nothing to undo', async () => {
    const doc = await snapshotSvg(widget(400, 300));
    const root = doc.querySelector('foreignObject')!.firstElementChild as HTMLElement;
    expect(root.getAttribute('style')).not.toMatch(/zoom/);
  });

  it('carries a border that differs by side, instead of the browser default', async () => {
    // A calendar event: a coloured left edge and nothing elsewhere. The
    // `border` shorthand reads back empty for that, and the <button> then drew
    // with the browser's own grey outline on all four sides.
    const el = widget(400, 300);
    const event = document.createElement('button');
    event.style.borderLeft = '4px solid rgb(255, 0, 0)';
    el.appendChild(event);
    const doc = await snapshotSvg(el);
    const style = doc.querySelector('foreignObject button')!.getAttribute('style')!;
    expect(style).toMatch(/border-left:\s*4px solid rgb\(255, 0, 0\)/);
  });

  it('embeds the text font before the emoji font spends the budget', async () => {
    // Declared in the order the page declares them: emoji first. Four of its
    // small faces fit under the per-face cap and together used up the whole
    // budget, so Inter was never embedded and every snapshot reflowed.
    const faces = [
      ...[0, 1, 2, 3].map((n) => `@font-face { font-family: "Noto Color Emoji"; src: url("/e${n}.woff2"); }`),
      '@font-face { font-family: Inter; src: url("/inter.woff2"); }',
    ];
    const style = document.createElement('style');
    style.textContent = faces.join('\n');
    document.head.appendChild(style);

    const sizes: Record<string, number> = { '/inter.woff2': 50 * 1024 };
    for (let n = 0; n < 4; n++) sizes[`/e${n}.woff2`] = 250 * 1024;
    const realFetch = global.fetch;
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      const path = new URL(String(url)).pathname;
      return { ok: true, blob: async () => new Blob([new Uint8Array(sizes[path] ?? 0)]) } as Response;
    }) as typeof fetch;

    try {
      const el = widget(400, 300);
      el.style.fontFamily = 'Inter, "Noto Color Emoji"';
      const doc = await snapshotSvg(el);
      const css = doc.querySelector('defs style')!.textContent!;
      expect(css).toMatch(/font-family:\s*Inter/);
    } finally {
      global.fetch = realFetch;
    }
  });
});
