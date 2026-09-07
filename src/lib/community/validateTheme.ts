/**
 * Validating a theme submitted to the community gallery.
 *
 * Three things are being defended here, in order of how badly they fail:
 *
 * 1. A theme reaches a `<style>` element rendered on the server. A value that
 *    can close that element is markup in the page, and there is no CSP to
 *    catch it. Handled by the token allowlist and the HSL grammar.
 * 2. A theme nobody can read is worse than no theme, and the person who
 *    installed it usually cannot tell whether the fault is the theme or the
 *    screen. Handled by the contrast check.
 * 3. This is a family kitchen display. Handled by the metadata limits, and
 *    by a human reading the pull request — see the note on that below.
 */
import { THEME_TOKENS, isValidTokenValue, isValidShape, normalizeShape, normalizeTokenKeys, SHAPE_LIMITS, type Theme, type ThemeTokens } from '@/lib/themes/tokens';
import { checkThemeContrast, type ContrastIssue } from '@/lib/themes/contrast';

export interface ThemeValidationResult {
  valid: boolean;
  errors: string[];
  /** Legible but tiring pairs. Shown on the gallery card, not blocking. */
  warnings: ContrastIssue[];
  /**
   * Keys the schema does not know, which the projection will not carry.
   *
   * Not an error. A fork can theme surfaces this one does not have — weather
   * ramps, calendar and widget tints — and such a theme is still a perfectly
   * good nineteen-token theme underneath. But dropping twenty values in
   * silence means it merges and then installs looking flatter than it did at
   * home, with nothing anywhere saying why. Reported so the submitter is told
   * once, plainly, instead of discovering it.
   */
  unknownTokens: string[];
}

export interface CommunityThemeEntry {
  id: string;
  file: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  createdAt: string;
  /** Surfaced on the card so someone installing can judge for themselves. */
  contrastWarnings: number;
}

const NAME_RE = /^[\w\s'&.-]{1,40}$/;
const TAG_RE = /^[a-z0-9-]{1,20}$/;
const AUTHOR_RE = /^[\w\s'&.-]{1,50}$/;

/**
 * Words that make a submission not worth reviewing.
 *
 * Deliberately small and deliberately not the whole policy. A list like this
 * catches the careless and none of the deliberate — it will flag "Scunthorpe"
 * and miss anything written to get past it. The policy that actually applies
 * (nothing bigoted, nothing partisan, nothing designed to divide people) is
 * enforced by a person reading the pull request before it merges, which every
 * submission goes through. This is a filter, not the standard.
 */
const BLOCKLIST = [
  'shit', 'fuck', 'ass', 'asshole', 'bitch', 'bastard', 'damn', 'crap',
  'dick', 'cock', 'pussy', 'slut', 'whore', 'nigger', 'faggot', 'retard',
];

function containsBlocked(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKLIST.some((word) => lower.includes(word));
}

function validateTokenSet(tokens: unknown, mode: string, errors: string[]): tokens is ThemeTokens {
  if (!tokens || typeof tokens !== 'object') {
    errors.push(`Missing "${mode}" colours.`);
    return false;
  }
  const obj = tokens as Record<string, unknown>;
  let ok = true;
  for (const token of THEME_TOKENS) {
    const value = obj[token];
    if (value === undefined) {
      errors.push(`"${mode}" is missing ${token}.`);
      ok = false;
    } else if (!isValidTokenValue(value)) {
      // The value is not echoed back. It is submitter-controlled text and this
      // message is rendered into a GitHub comment.
      errors.push(`"${mode}" has an invalid value for ${token}. Expected a bare HSL triple, e.g. "222 47% 11%".`);
      ok = false;
    }
  }
  return ok;
}

/**
 * Token keys present in a submission that this schema has no place for.
 *
 * Collected across both modes and deduplicated, because a theme that sets a
 * weather ramp sets it in light and dark and naming each twice reads as forty
 * problems rather than twenty.
 */
export function unrecognizedTokens(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const known = new Set<string>(THEME_TOKENS);
  const found = new Set<string>();
  for (const mode of ['light', 'dark'] as const) {
    for (const key of Object.keys(normalizeTokenKeys(obj[mode]))) {
      if (!known.has(key)) found.add(key);
    }
  }
  return [...found].sort();
}

export function validateCommunityTheme(data: unknown): ThemeValidationResult {
  const errors: string[] = [];
  let warnings: ContrastIssue[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Submission is not an object.'], warnings, unknownTokens: [] };
  }
  const obj = data as Record<string, unknown>;

  if (obj.type !== 'prism-theme') errors.push('Missing "type": "prism-theme".');
  if (obj.version !== 1) errors.push('Unsupported version. Expected 1.');

  const name = obj.name;
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    errors.push('Name must be 1-40 characters, letters, numbers, spaces and basic punctuation.');
  } else if (containsBlocked(name)) {
    errors.push('Please choose a different name.');
  }

  const description = obj.description;
  if (typeof description !== 'string' || description.length < 1 || description.length > 160) {
    errors.push('Description must be 1-160 characters.');
  } else if (containsBlocked(description)) {
    errors.push('Please reword the description.');
  }

  const author = obj.author;
  if (typeof author !== 'string' || !AUTHOR_RE.test(author)) {
    errors.push('Author must be 1-50 characters.');
  }

  const tags = obj.tags;
  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.length > 5) {
      errors.push('At most 5 tags.');
    } else if (!tags.every((t) => typeof t === 'string' && TAG_RE.test(t))) {
      errors.push('Tags must be lowercase letters, numbers and hyphens, up to 20 characters.');
    }
  }

  if (obj.shape !== undefined && !isValidShape(obj.shape)) {
    errors.push(
      `Corner radius must be a number between ${SHAPE_LIMITS.radius.min} and ` +
      `${SHAPE_LIMITS.radius.max}. Beyond that, cards stop looking styled and start looking broken.`,
    );
  }

  // Normalised once, and everything downstream reads these rather than the raw
  // object. The contrast check used to be handed `obj.light` directly, so a
  // theme spelling its keys with the CSS prefix validated and then measured
  // contrast on nineteen undefined values.
  const light = normalizeTokenKeys(obj.light);
  const dark = normalizeTokenKeys(obj.dark);

  const lightOk = validateTokenSet(light, 'light', errors);
  const darkOk = validateTokenSet(dark, 'dark', errors);

  if (lightOk && darkOk) {
    const contrast = checkThemeContrast({ light: light as ThemeTokens, dark: dark as ThemeTokens });
    warnings = contrast.warnings;
    for (const issue of contrast.errors) {
      errors.push(
        `${issue.pair} has a contrast ratio of ${issue.ratio.toFixed(2)}:1. ` +
        'Prism is read from across a room, so text needs at least 3:1.',
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    unknownTokens: unrecognizedTokens(data),
  };
}

/**
 * Build the object that gets committed.
 *
 * A projection, not the parsed submission. Every field is copied by name from
 * a fixed list, so a key the schema does not know about has no path into the
 * repository — it is structurally absent rather than filtered out.
 *
 * This is the same discipline the gallery already uses when applying a layout,
 * where only i/x/y/w/h are read from the payload. Moved to the write side,
 * which is where it matters more: the read side protects one user, the write
 * side protects everyone who fetches the file afterwards.
 */
export function projectCommunityTheme(data: unknown, id: string): Theme & {
  type: 'prism-theme';
  version: 1;
  author: string;
  tags: string[];
} {
  const obj = data as Record<string, unknown>;
  const pickTokens = (src: unknown): ThemeTokens => {
    const s = normalizeTokenKeys(src);
    const out = {} as ThemeTokens;
    for (const token of THEME_TOKENS) out[token] = s[token] as string;
    return out;
  };

  return {
    type: 'prism-theme',
    version: 1,
    id,
    name: obj.name as string,
    description: obj.description as string,
    author: obj.author as string,
    tags: Array.isArray(obj.tags) ? (obj.tags as string[]).slice(0, 5) : [],
    light: pickTokens(obj.light),
    dark: pickTokens(obj.dark),
    // Clamped rather than copied, so an out-of-range value that slipped past
    // validation still cannot reach the page.
    shape: normalizeShape(obj.shape),
  };
}

/**
 * The row that goes into `community/themes/index.json`.
 *
 * Lives here rather than in the workflow because the workflow is YAML with
 * JavaScript embedded in a string, which nothing can test. Everything the
 * gallery card shows is decided in this function instead.
 */
export function buildThemeIndexEntry(
  theme: { id: string; name: string; description: string; author: string; tags: string[] },
  warnings: ContrastIssue[],
  today: string,
): CommunityThemeEntry {
  return {
    id: theme.id,
    file: `${theme.id}.json`,
    name: theme.name,
    description: theme.description,
    author: theme.author,
    tags: theme.tags,
    createdAt: today,
    // Text pairs only. An edge warning means the borders are subtle, which is
    // a style rather than a defect — see the note on ContrastIssue.kind. The
    // README promises this number is about the eight text pairs, so counting
    // edges here would make the card contradict the documentation.
    contrastWarnings: warnings.filter((w) => w.kind === 'text').length,
  };
}
