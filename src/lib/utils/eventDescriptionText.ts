/**
 * Reduce an event description to plain text, with no DOM.
 *
 * Descriptions are written by whoever sent the invite, so they are untrusted,
 * and they are stored exactly as they arrived: the sync path writes upstream
 * HTML straight to the row, so no write-side filter can make the stored value
 * safe. Each consumer has to make it safe for its own context instead. The
 * browser gets an allowlist (see eventDescriptionHtml.ts). Everything that is
 * not a browser gets this.
 *
 * "Not a browser" mostly means a language model: the MCP server hands event
 * data to one. Markup matters there for a different reason than XSS. Text a
 * person cannot see is still text a model reads, so an HTML comment, a title
 * attribute, a zero-width run or a bidi override is an instruction channel.
 * Flattening to text removes the hiding places rather than the tags.
 *
 * Runs on the server, so it cannot use DOMPurify. That is acceptable here in a
 * way it would not be for HTML output: the result is never parsed as HTML, so
 * a tag this misses degrades to visible text, not to script.
 */

/** Entities common in calendar descriptions. `amp` is handled last, separately. */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
};

function fromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return '';
  // Lone surrogates would produce unpaired halves.
  if (code >= 0xd800 && code <= 0xdfff) return '';
  return String.fromCodePoint(code);
}

function decodeEntities(input: string): string {
  let out = input.replace(/&#x([0-9a-f]+);/gi, (_m, hex) => fromCodePoint(parseInt(hex, 16)));
  out = out.replace(/&#(\d+);/g, (_m, dec) => fromCodePoint(parseInt(dec, 10)));
  out = out.replace(/&([a-z][a-z0-9]*);/gi, (match, name: string) => {
    const key = name.toLowerCase();
    // Decoding &amp; here would let &amp;lt; become a second round of markup.
    if (key === 'amp') return match;
    return NAMED_ENTITIES[key] ?? match;
  });
  return out.replace(/&amp;/gi, '&');
}

/** Block-level tags stand in for a line break once the markup is gone. */
const BLOCK_CLOSE = /<\/(?:p|div|li|ul|ol|tr|table|h[1-6]|pre|blockquote)\s*>/gi;
const BLOCK_OPEN = /<(?:p|div|li|tr|h[1-6]|blockquote)\b[^>]*>/gi;
const LINE_BREAK = /<(?:br|hr)\b[^>]*>/gi;

/** Invisible characters: nothing legitimate needs them, and they hide text. */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

export function eventDescriptionToText(html: string | null | undefined): string {
  if (!html) return '';

  let text = html;

  // Strip until nothing changes: one pass can rebuild what it removed.
  // `<spa<x>n title="hidden">` loses `<x>` and becomes a whole tag, and
  // `<!-<x>- ... -->` becomes a comment (CodeQL incomplete sanitization).
  let before: string;
  do {
    before = text;
    // Raw-text elements: drop the content too, or the script body reads as prose.
    text = text.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
    text = text.replace(/<!--[\s\S]*?-->/g, ' ');

    text = text.replace(BLOCK_CLOSE, '\n');
    text = text.replace(LINE_BREAK, '\n');
    text = text.replace(BLOCK_OPEN, '\n');

    // Everything else goes, attributes included: this is what closes `title`.
    text = text.replace(/<[^<>]*>/g, '');
  } while (text !== before);

  text = decodeEntities(text);
  text = text.replace(INVISIBLE, '');

  // Every block boundary emitted a newline, so `</div><div>` produced two and a
  // Google paragraph break produced three. Blank lines carry nothing a reader
  // of plain text needs, so runs collapse to a single break.
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n[\s\n]*/g, '\n')
    .trim();
}
