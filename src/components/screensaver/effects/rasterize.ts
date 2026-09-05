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
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'white-space', 'text-shadow',
  'color', 'background-color', 'background-image', 'background-size', 'background-position',
  'border', 'border-radius', 'box-shadow', 'opacity', 'transform',
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

/** The font families this subtree actually renders in. */
function familiesUsed(root: HTMLElement): Set<string> {
  const used = new Set<string>();
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
    for (const name of getComputedStyle(el).fontFamily.split(',')) {
      const clean = name.trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (clean) used.add(clean);
    }
  }
  return used;
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
function embeddedFontCss(families: Set<string>): Promise<string> {
  const key = [...families].sort().join('|');
  const hit = fontCss.get(key);
  if (hit) return hit;

  const built = (async () => {
    const faces: string[] = [];
    let spent = 0;
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin stylesheet; nothing we can read
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const family = rule.style
          .getPropertyValue('font-family')
          .trim()
          .replace(/^["']|["']$/g, '')
          .toLowerCase();
        if (family && !families.has(family)) continue;

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
