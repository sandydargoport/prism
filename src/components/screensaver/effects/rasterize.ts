/**
 * A live widget's own pixels, as an ImageData.
 *
 * The browser will draw an element into a canvas if you wrap it in an SVG
 * <foreignObject> and load that SVG as an image — but the SVG is its own
 * document, loaded from a data: URL, so it can see NOTHING of the page it came
 * from. Two consequences, both of which look like bugs rather than omissions:
 *
 *  - Web fonts do not load, so text lays out with fallback metrics. Measured on
 *    the clock widget: "6:12", "PM" and the date rendered on top of each other.
 *  - Images do not load, our own included. Same-origin does not help: the data:
 *    URL is a different origin, so every <img> comes out a broken placeholder.
 *
 * So both have to be carried in by value: @font-face rules rewritten with the
 * font bytes as data URIs, and every <img> src replaced with its own data URI.
 * The fonts are fetched once and cached for the life of the page.
 *
 * Only the fireworks effect needs any of this; the others are masks.
 */

/** Properties that affect appearance. Inlining all ~340 computed properties
 *  produced a 21MB document and took 1.5s; this list takes 13ms. */
const PAINTED = [
  'display', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height',
  'margin', 'padding', 'box-sizing', 'overflow',
  // A thin, faint scrollbar on screen came out as a full-width white one in the
  // snapshot, and its track burst as a straight line of fragments.
  'scrollbar-width', 'scrollbar-color',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'white-space', 'text-shadow',
  'color', 'background-color', 'background-image', 'background-size', 'background-position',
  // Each side, not the `border` shorthand. The shorthand reads back as an empty
  // string whenever the sides differ (a calendar event's coloured left edge,
  // say), so nothing was inlined and the snapshot fell back to the browser's
  // own default for a <button>: a grey outline on every side. Those outlines
  // flew apart with the burst, drawn round boxes that have none on screen.
  'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-radius', 'box-shadow', 'opacity', 'transform',
  'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
  'grid-template-columns', 'grid-template-rows',
  'fill', 'stroke', 'stroke-width',
];

const fontCss = new Map<string, Promise<string>>();

/**
 * What we will spend carrying fonts into a snapshot.
 *
 * A colour-emoji font is glyph artwork, not text metrics, so leaving it out
 * cannot shift the layout of ordinary text — and it is enormous: Prism's Noto
 * Color Emoji is 12MB across ten faces, against 213KB for the seven Inter
 * faces. It gets into the net because it sits at the end of every font stack as
 * a fallback, so matching on "families this widget renders in" matches it too.
 * A size budget excludes it on the only grounds that actually matter here.
 */
const MAX_FACE_BYTES = 400 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

function blobToDataUri(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => resolve(null);
    fr.readAsDataURL(blob);
  });
}

async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * The font families this subtree actually renders in, most wanted first.
 *
 * Ordered by how early each one comes in a font stack, because the byte budget
 * below is spent in this order. Spent in stylesheet order instead, the emoji
 * font won: its faces are declared first, the small ones fit under the
 * per-face cap, and four of them used up the whole budget before Inter was
 * reached. Every snapshot was then set in a fallback face, wider than Inter,
 * so its text wrapped and clipped and the widget that burst was not the one on
 * screen.
 */
function familiesUsed(root: HTMLElement): string[] {
  const rank = new Map<string, number>();
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
    getComputedStyle(el).fontFamily.split(',').forEach((name, i) => {
      const clean = name.trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (clean && i < (rank.get(clean) ?? Infinity)) rank.set(clean, i);
    });
  }
  return [...rank.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
}

/** By its text, not instanceof: not every DOM (jsdom, for one) has the class. */
function isFontFace(rule: CSSRule): rule is CSSFontFaceRule {
  return rule.cssText.trimStart().startsWith('@font-face');
}

/**
 * The @font-face rules for those families, carrying their bytes inline.
 *
 * Embedding every face on the page was catastrophic and not obviously so:
 * Prism self-hosts 18 faces totalling 12MB, which is 16.7MB once base64'd, and
 * that went into EVERY snapshot. Decoding it stalled the main thread for 1.1s
 * at the exact moment a widget was meant to burst. A widget renders in one or
 * two of those faces, so the rest is pure freight.
 */
function embeddedFontCss(families: string[]): Promise<string> {
  const key = families.join('|');
  const hit = fontCss.get(key);
  if (hit) return hit;

  const built = (async () => {
    const wanted: { rank: number; rule: CSSFontFaceRule }[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin stylesheet; nothing we can read
      }
      for (const rule of Array.from(rules)) {
        if (!isFontFace(rule)) continue;
        const family = rule.style
          .getPropertyValue('font-family')
          .trim()
          .replace(/^["']|["']$/g, '')
          .toLowerCase();
        const rank = families.indexOf(family);
        if (family && rank < 0) continue;
        wanted.push({ rank: rank < 0 ? families.length : rank, rule });
      }
    }
    // Stable, so faces of one family keep their stylesheet order.
    wanted.sort((a, b) => a.rank - b.rank);

    const faces: string[] = [];
    let spent = 0;
    for (const { rule } of wanted) {
      let text = rule.cssText;
      const urls = [...text.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]!);
      let skip = false;
      for (const u of urls) {
        if (u.startsWith('data:')) continue;
        const blob = await fetchBlob(new URL(u, location.href).href);
        if (!blob) continue;
        if (blob.size > MAX_FACE_BYTES || spent + blob.size > MAX_TOTAL_BYTES) { skip = true; break; }
        const data = await blobToDataUri(blob);
        if (!data) continue;
        spent += blob.size;
        text = text.replace(u, data);
      }
      if (!skip) faces.push(text);
    }
    return faces.join('\n');
  })();

  fontCss.set(key, built);
  return built;
}

export function warmRasterCache(root: HTMLElement | null): void {
  if (root) void embeddedFontCss(familiesUsed(root));
}

export async function rasterize(
  el: HTMLElement,
  /**
   * Last chance to change the snapshot before it is drawn. Runs on the CLONE,
   * after the computed styles have been inlined, so it wins over them — and so
   * the live widget on screen never changes. Doing this to the real element
   * instead made it flash opaque for the two or three frames the capture takes.
   */
  prepare?: (clone: HTMLElement) => void,
): Promise<ImageData | null> {
  const rect = el.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width < 2 || height < 2) return null;

  // The size the widget is laid out at, which is not the size it is drawn at
  // under a CSS zoom (a widget's own text size, say). Computed styles are all in the
  // first, so the snapshot is laid out there and zoomed back up to the second.
  // Without this the widget came out at its unzoomed size in the top-left of
  // its own box: the burst was smaller than the widget, off centre, and cut
  // off along the right and bottom with the rest of the box empty.
  const laidOut = parseFloat(getComputedStyle(el).width);
  const zoom = laidOut > 0 ? rect.width / laidOut : 1;

  const clone = el.cloneNode(true) as HTMLElement;
  const source = [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))];
  const copy = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];

  for (let i = 0; i < source.length; i++) {
    const cs = getComputedStyle(source[i]!);
    let css = '';
    for (const prop of PAINTED) {
      const v = cs.getPropertyValue(prop);
      if (v) css += `${prop}:${v};`;
    }
    copy[i]!.setAttribute('style', css);
  }

  // Carry the images in by value too, or they arrive as broken placeholders.
  await Promise.all(
    Array.from(clone.querySelectorAll('img')).map(async (img) => {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      const data = await toDataUri(new URL(src, location.href).href);
      if (data) img.setAttribute('src', data);
      else img.remove();
    }),
  );

  if (Math.abs(zoom - 1) > 0.001) {
    clone.setAttribute('style', `${clone.getAttribute('style') ?? ''}zoom:${zoom};`);
  }

  prepare?.(clone);

  const fonts = await embeddedFontCss(familiesUsed(el));
  const body = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<defs><style type="text/css">${fonts}</style></defs>` +
    `<foreignObject width="100%" height="100%">${body}</foreignObject></svg>`;

  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  try {
    await img.decode();
  } catch {
    return null; // a widget we cannot snapshot simply does not get this effect
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, width, height);
}
