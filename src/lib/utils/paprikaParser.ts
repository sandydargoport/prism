/**
 * Paprika HTML Export Parser
 *
 * Parses recipe data from Paprika 3's HTML export format.
 * Paprika exports recipes as HTML files with structured content.
 */
import { parse, type DefaultTreeAdapterMap } from 'parse5';

export interface PaprikaRecipe {
  name: string;
  description?: string;
  ingredients: Array<{ text: string }>;
  instructions?: string;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  servings?: number;
  source?: string;
  sourceUrl?: string;
  categories?: string[];
  imageUrl?: string;
  notes?: string;
  rating?: number;
}

/**
 * Parse time string to minutes.
 * Examples: "30 min", "1 hr 30 min", "2 hours", "45 minutes"
 */
function parseTimeString(timeStr: string | undefined): number | undefined {
  if (!timeStr) return undefined;

  let totalMinutes = 0;

  // Match hours
  const hoursMatch = timeStr.match(/(\d+)\s*(?:hr|hour)/i);
  if (hoursMatch && hoursMatch[1]) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60;
  }

  // Match minutes
  const minutesMatch = timeStr.match(/(\d+)\s*(?:min)/i);
  if (minutesMatch && minutesMatch[1]) {
    totalMinutes += parseInt(minutesMatch[1], 10);
  }

  return totalMinutes > 0 ? totalMinutes : undefined;
}

/**
 * Parse servings from string.
 * Examples: "4 servings", "Serves 6", "Makes 12"
 */
function parseServingsString(servingsStr: string | undefined): number | undefined {
  if (!servingsStr) return undefined;

  const match = servingsStr.match(/(\d+)/);
  return match && match[1] ? parseInt(match[1], 10) : undefined;
}

/**
 * Parse rating from string or stars.
 * Examples: "4 stars", "★★★★☆", "3/5"
 */
function parseRating(ratingStr: string | undefined): number | undefined {
  if (!ratingStr) return undefined;

  // Count filled stars
  const filledStars = (ratingStr.match(/★/g) || []).length;
  if (filledStars > 0) {
    return filledStars;
  }

  // Parse "X stars" format
  const starsMatch = ratingStr.match(/(\d+)\s*star/i);
  if (starsMatch && starsMatch[1]) {
    return parseInt(starsMatch[1], 10);
  }

  // Parse "X/5" format
  const fractionMatch = ratingStr.match(/(\d+)\s*\/\s*5/);
  if (fractionMatch && fractionMatch[1]) {
    return parseInt(fractionMatch[1], 10);
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Reading the export (#1062)
//
// The export is parsed once into a tree (parse5, linear in its size) and every
// field is read from that tree. Nothing scans the whole file with a pattern:
// regexes over the raw HTML took seconds on a crafted file and held the
// server's only thread. Labelled fields ("Prep time: 30 min") are read from
// one text node at a time, and only from its first VALUE_MAX characters.
// ---------------------------------------------------------------------------

type Node = DefaultTreeAdapterMap['node'];
type ParentNode = DefaultTreeAdapterMap['parentNode'];
type Element = DefaultTreeAdapterMap['element'];
type TextNode = DefaultTreeAdapterMap['textNode'];

const VALUE_MAX = 200;

const isElement = (n: Node): n is Element => 'tagName' in n;
const isText = (n: Node): n is TextNode => n.nodeName === '#text';
const kids = (n: Node): Node[] => ('childNodes' in n ? (n as ParentNode).childNodes : []);
const attr = (el: Element, name: string) => el.attrs.find((a) => a.name === name)?.value;
const hasClass = (el: Element, re: RegExp) => re.test(attr(el, 'class') ?? '');

/** Every node under `root`, in document order, without recursion. */
function* walk(root: Node): Generator<Node> {
  const stack: Node[] = [...kids(root)].reverse();
  while (stack.length) {
    const n = stack.pop()!;
    yield n;
    const c = kids(n);
    for (let i = c.length - 1; i >= 0; i--) stack.push(c[i]!);
  }
}

function find(root: Node, test: (el: Element) => boolean): Element | undefined {
  for (const n of walk(root)) if (isElement(n) && test(n)) return n;
  return undefined;
}

function findAll(root: Node, test: (el: Element) => boolean): Element[] {
  const out: Element[] = [];
  for (const n of walk(root)) if (isElement(n) && test(n)) out.push(n);
  return out;
}

/** An element's text: <br> is a line break, a paragraph ends with a blank line. */
function textOf(root: Node): string {
  let out = '';
  // Iterative, so deeply nested markup cannot overflow the stack. A string on
  // the stack is text to emit once an element's children are done.
  const stack: Array<Node | string> = [...kids(root)].reverse();
  while (stack.length) {
    const n = stack.pop()!;
    if (typeof n === 'string') { out += n; continue; }
    if (isText(n)) { out += n.value; continue; }
    if (!isElement(n)) continue;
    if (n.tagName === 'br') { out += '\n'; continue; }
    if (n.tagName === 'p') stack.push('\n\n');
    else if (n.tagName === 'div' || n.tagName === 'li') stack.push('\n');
    const c = kids(n);
    for (let i = c.length - 1; i >= 0; i--) stack.push(c[i]!);
  }
  return out.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * The text after a label such as "Prep time:", from the first text node that
 * has one. `label` must not end in an open-ended repeat.
 */
function labelled(root: Node, label: RegExp): string | undefined {
  for (const n of walk(root)) {
    if (!isText(n)) continue;
    const m = label.exec(n.value);
    if (!m) continue;
    const rest = n.value.slice(m.index + m[0].length, m.index + m[0].length + VALUE_MAX).replace(/^[:\s]+/, '');
    if (rest.trim()) return rest;
  }
  return undefined;
}

/** Each list item's text; with no list items, each non-empty line. */
function lines(el: Element): string[] {
  const items = findAll(el, (e) => e.tagName === 'li');
  const raw = items.length ? items.map(textOf) : textOf(el).split('\n');
  return raw.map((t) => t.trim()).filter(Boolean);
}

const DEPTH_MAX = 500;
// Elements that never nest (void) or that close themselves when the next one
// opens (an unclosed <li> or <p> is valid HTML), so they do not deepen a page.
const FLAT = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
  'li', 'p', 'dt', 'dd', 'option', 'tr', 'td', 'th', 'tbody', 'thead', 'tfoot', 'colgroup', 'rb', 'rt', 'rp', 'optgroup']);

/** The deepest nesting of open tags, from one linear pass over the text. */
function nestingDepth(html: string): number {
  let depth = 0;
  let max = 0;
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9-]{0,30})/g;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    const name = m[2]!.toLowerCase();
    if (FLAT.has(name)) continue;
    if (m[1]) depth = Math.max(0, depth - 1);
    else if (++depth > max) max = depth;
  }
  return max;
}

/**
 * Parse a single recipe from a part of the export.
 */
function parseRecipeSection(root: Node): PaprikaRecipe | null {
  const nameEl = find(root, (e) => e.tagName === 'h1' && hasClass(e, /title/i))
    ?? find(root, (e) => e.tagName === 'h1')
    ?? find(root, (e) => e.tagName === 'title');
  const name = nameEl ? textOf(nameEl) : '';
  if (!name) return null;

  const recipe: PaprikaRecipe = { name, ingredients: [] };
  const block = (re: RegExp) => find(root, (e) => (e.tagName === 'div' || e.tagName === 'section') && hasClass(e, re));

  const desc = find(root, (e) => e.tagName === 'div' && hasClass(e, /description/i));
  if (desc) recipe.description = textOf(desc);

  const ingredients = block(/ingredient/i);
  if (ingredients) {
    recipe.ingredients = lines(ingredients).map((text) => ({ text }));
  } else {
    // A heading "Ingredients" followed by a list.
    let afterHeading = false;
    for (const n of walk(root)) {
      if (!isElement(n)) continue;
      if (/^h[1-6]$/.test(n.tagName) && /ingredients[:\s]*$/i.test(textOf(n).slice(-VALUE_MAX))) afterHeading = true;
      else if (afterHeading && n.tagName === 'ul') {
        recipe.ingredients = lines(n).map((text) => ({ text }));
        break;
      }
    }
  }

  const instructions = block(/instruction|direction/i);
  if (instructions) recipe.instructions = textOf(instructions);

  recipe.prepTime = parseTimeString(labelled(root, /prep(?:\s{0,10}time)?/i));
  recipe.cookTime = parseTimeString(labelled(root, /cook(?:\s{0,10}time)?/i));
  recipe.totalTime = parseTimeString(labelled(root, /total(?:\s{0,10}time)?/i));
  recipe.servings = parseServingsString(labelled(root, /servings?|serves|makes/i));
  for (const k of ['prepTime', 'cookTime', 'totalTime', 'servings'] as const) if (recipe[k] === undefined) delete recipe[k];

  // "Source: <a href=...>": a label right before a link.
  for (const n of walk(root)) {
    if (isText(n) && /(?:source|original)[:\s]{0,10}$/i.test(n.value.slice(-VALUE_MAX))) {
      const parent = n.parentNode as ParentNode | null;
      const next = parent ? parent.childNodes[parent.childNodes.indexOf(n) + 1] : undefined;
      const href = next && isElement(next) && next.tagName === 'a' ? attr(next, 'href') : undefined;
      if (href) { recipe.sourceUrl = href; break; }
    }
  }

  const source = labelled(root, /source/i)?.trim();
  if (source && !source.includes('http')) recipe.source = source;

  const categories = labelled(root, /categor(?:y|ies)/i);
  if (categories) recipe.categories = categories.split(/[,;]/).map((c) => c.trim()).filter(Boolean);

  const image = find(root, (e) => e.tagName === 'img' && hasClass(e, /recipe/i))
    ?? find(root, (e) => e.tagName === 'img' && (attr(e, 'src') ?? '').startsWith('data:image'));
  const src = image ? attr(image, 'src') : undefined;
  if (src) recipe.imageUrl = src;

  const notes = find(root, (e) => e.tagName === 'div' && hasClass(e, /notes?/i));
  if (notes) recipe.notes = textOf(notes);

  const ratingText = labelled(root, /rating/i)
    ?? (() => { const el = find(root, (e) => hasClass(e, /rating/i)); return el ? textOf(el).slice(0, VALUE_MAX) : undefined; })();
  const rating = parseRating(ratingText);
  if (rating !== undefined) recipe.rating = rating;

  return recipe;
}

/**
 * Parse Paprika HTML export which may contain multiple recipes.
 *
 * @param html - The HTML content from a Paprika export
 * @returns Array of parsed recipes
 */
export function parsePaprikaHtml(html: string): PaprikaRecipe[] {
  // The HTML parser slows down sharply with nesting depth (100,000 nested
  // divs took two minutes), and a real export is nearly flat. Refuse anything
  // deeper than DEPTH_MAX before parsing.
  if (nestingDepth(html) > DEPTH_MAX) return [];
  const doc = parse(html);
  // Paprika exports can have multiple recipes as separate articles.
  const articles = findAll(doc, (e) => e.tagName === 'article');
  const parts: Node[] = articles.length ? articles : [doc];
  return parts.map(parseRecipeSection).filter((r): r is PaprikaRecipe => r !== null);
}

export default parsePaprikaHtml;
