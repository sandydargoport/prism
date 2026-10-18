/**
 * Auto-capitalization for the on-screen keyboard (#635).
 *
 * Works like a phone keyboard: at the start of a field, after a sentence
 * (`.`, `!` or `?` followed by whitespace) and at the start of a line, the
 * next letter is a capital, and the keyboard drops back to lowercase once it
 * is typed. The field decides whether this applies at all: passwords, email
 * addresses, URLs, numbers and search boxes never get it, and an
 * `autocapitalize` attribute is honoured as the HTML spec describes.
 *
 * The decisions are pure functions so they can be tested without a browser;
 * the DOM helpers at the bottom only read the field.
 */

export type AutoCapitalizeMode = 'off' | 'sentences' | 'words' | 'characters';

export type FieldInfo = {
  kind: 'input' | 'textarea' | 'contenteditable';
  /** Lowercased `type` of an input. */
  type?: string;
  /** The field's `autocapitalize` attribute, else its form's. */
  autocapitalize?: string | null;
  /**
   * The field's own `inputmode`, as declared. Read it before the provider sets
   * `inputmode="none"` to keep the OS keyboard down (#498).
   */
  inputMode?: string | null;
  /** The field's `autocomplete` attribute. */
  autocomplete?: string | null;
};

/** Input types the spec exempts from autocapitalize, plus number. */
const NEVER_TYPES = new Set(['password', 'email', 'url', 'number', 'tel']);
/** inputmode values that mean "not prose". */
const NON_PROSE_INPUT_MODES = new Set(['numeric', 'decimal', 'tel', 'email', 'url']);
/** autocomplete tokens for values that are typed exactly as they are. */
const VERBATIM_AUTOCOMPLETE = new Set([
  'username', 'email', 'url', 'one-time-code', 'current-password', 'new-password',
]);

function explicitMode(value: string | null | undefined): AutoCapitalizeMode | null {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'off':
    case 'none':
      return 'off';
    case 'on':
    case 'sentences':
      return 'sentences';
    case 'words':
      return 'words';
    case 'characters':
      return 'characters';
    default:
      return null; // absent, empty or unknown: the default applies
  }
}

/** How the on-screen keyboard should capitalize in this field. */
export function autoCapitalizeMode(field: FieldInfo): AutoCapitalizeMode {
  const type = field.type?.toLowerCase();
  if (field.kind === 'input' && type && NEVER_TYPES.has(type)) return 'off';

  const explicit = explicitMode(field.autocapitalize);
  if (explicit) return explicit;

  if (field.inputMode && NON_PROSE_INPUT_MODES.has(field.inputMode.toLowerCase())) return 'off';
  const tokens = (field.autocomplete ?? '').toLowerCase().split(/\s+/);
  if (tokens.some(t => VERBATIM_AUTOCOMPLETE.has(t) || t.startsWith('tel'))) return 'off';
  if (field.kind === 'input' && type === 'search') return 'off';
  return 'sentences';
}

// End of a sentence: . ! or ? (possibly closed by quotes or brackets), then
// whitespace, at the very end of the text before the caret.
const SENTENCE_END = /[.!?]['"’”)\]]*\s+$/;
// A line start: a newline followed only by spaces or tabs.
const LINE_START = /\n[ \t]*$/;

/**
 * Whether the next letter typed at `caret` should be a capital.
 * `caret` is the insertion point; null means the end of the value.
 */
export function shouldAutoShift(value: string, caret: number | null, field: FieldInfo): boolean {
  const mode = autoCapitalizeMode(field);
  if (mode === 'off') return false;
  if (mode === 'characters') return true;

  const pos = caret === null ? value.length : Math.max(0, Math.min(caret, value.length));
  const before = value.slice(0, pos);
  if (before.trim() === '') return true; // start of the field
  if (mode === 'words') return /\s$/.test(before);
  return SENTENCE_END.test(before) || LINE_START.test(before);
}

// ---------------------------------------------------------------------------
// Shift state: the user's own Shift / Caps Lock, and the automatic one
// ---------------------------------------------------------------------------

export type ShiftState = {
  /**
   * Shift or Caps Lock tapped by the user. It always wins over the automatic
   * capital. Shift is one-shot, as on a phone: the next character clears it.
   */
  manual: boolean;
  /** Caps Lock: `manual` stays on until Shift or Caps Lock is tapped again. */
  locked: boolean;
  /** The one-shot automatic capital is armed. */
  auto: boolean;
  /**
   * The user turned the capital off at this spot. Holds until the next edit,
   * caret move or field change, so the automatic one does not come straight
   * back.
   */
  autoCancelled: boolean;
};

export const INITIAL_SHIFT_STATE: ShiftState = { manual: false, locked: false, auto: false, autoCancelled: false };

const OFF_HELD: ShiftState = { manual: false, locked: false, auto: false, autoCancelled: true };

export type ShiftLayoutName = 'default' | 'shift' | 'autoshift';

/**
 * A tap on Shift or Caps Lock. Shift gives one capital and Caps Lock locks
 * them, as on a phone. Either one, tapped while any capital is on (manual,
 * locked or the automatic one), turns capitals off, and holds the automatic
 * one back so it does not reappear under the user's finger.
 */
export function pressShiftKey(state: ShiftState, key: 'shift' | 'lock'): ShiftState {
  if (state.manual) return OFF_HELD;
  if (state.auto && key === 'shift') return OFF_HELD;
  return { manual: true, locked: key === 'lock', auto: false, autoCancelled: false };
}

/**
 * A character was typed. A one-shot Shift is used up by it; Caps Lock and the
 * automatic capital are left to `applyAutoShift`, which runs after the edit.
 */
export function consumeShift(state: ShiftState): ShiftState {
  if (state.manual && !state.locked) return { ...INITIAL_SHIFT_STATE };
  return state;
}

/**
 * Re-evaluate after an edit, a caret move or a field change. `wanted` is
 * `shouldAutoShift(...)` for the new position.
 */
export function applyAutoShift(state: ShiftState, wanted: boolean): ShiftState {
  if (state.manual) return { manual: true, locked: state.locked, auto: false, autoCancelled: false };
  return { manual: false, locked: false, auto: wanted, autoCancelled: false };
}

/** The simple-keyboard layout for a shift state. */
export function layoutNameFor(state: ShiftState): ShiftLayoutName {
  if (state.manual) return 'shift';
  if (state.auto && !state.autoCancelled) return 'autoshift';
  return 'default';
}

/**
 * The automatic-capital layout: the default rows with only the letters
 * uppercased. Digits and punctuation stay put, so "3 eggs" at the start of a
 * field still types a 3 rather than the shifted `#`.
 */
export function autoShiftLayout(defaultRows: string[]): string[] {
  return defaultRows.map(row =>
    row.split(' ').map(key => (/^[a-z]$/.test(key) ? key.toUpperCase() : key)).join(' '),
  );
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/** Describe a focused field. `inputMode` is its declared inputmode, if known. */
export function fieldInfoFor(el: HTMLElement, inputMode: string | null = el.getAttribute('inputmode')): FieldInfo {
  const own = el.getAttribute('autocapitalize');
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return {
      kind: el instanceof HTMLInputElement ? 'input' : 'textarea',
      type: el instanceof HTMLInputElement ? el.type.toLowerCase() : undefined,
      autocapitalize: own ?? el.form?.getAttribute('autocapitalize') ?? null,
      inputMode,
      autocomplete: el.getAttribute('autocomplete'),
    };
  }
  return { kind: 'contenteditable', autocapitalize: own, inputMode, autocomplete: null };
}

/** The caret in an input or textarea, or null when the type has none (email). */
export function caretOf(el: HTMLInputElement | HTMLTextAreaElement): number | null {
  try {
    return el.selectionStart;
  } catch {
    return null;
  }
}

const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE']);

/**
 * The text before the caret in a contenteditable host, with a trailing "\n"
 * when the caret starts a line (a new block or the node after a `<br>`), since
 * block boundaries do not appear in the text itself. Null when the selection
 * is not in `host`.
 */
export function textBeforeCaret(host: HTMLElement): string | null {
  const sel = host.ownerDocument.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const caret = sel.getRangeAt(0);
  const node = caret.startContainer;
  if (!host.contains(node)) return null;

  const range = host.ownerDocument.createRange();
  range.selectNodeContents(host);
  range.setEnd(node, caret.startOffset);
  const text = range.toString();
  if (text === '') return text;

  // Right after a <br>?
  const prev = node.nodeType === Node.TEXT_NODE
    ? (caret.startOffset === 0 ? node.previousSibling : null)
    : node.childNodes[caret.startOffset - 1] ?? null;
  if (prev?.nodeName === 'BR') return `${text}\n`;

  // At the start of a block inside the host?
  let el: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  while (el && el !== host && !(el instanceof HTMLElement && BLOCK_TAGS.has(el.tagName))) {
    el = el.parentNode;
  }
  if (el && el !== host) {
    const inBlock = host.ownerDocument.createRange();
    inBlock.selectNodeContents(el);
    inBlock.setEnd(node, caret.startOffset);
    if (inBlock.toString().trim() === '') return `${text}\n`;
  }
  return text;
}

// ---------------------------------------------------------------------------
// Double space for a full stop, as on a phone
// ---------------------------------------------------------------------------

/** Two taps of space within this window count as a double space. */
export const DOUBLE_SPACE_MS = 500;

/**
 * The text before the caret after a double space, with the two spaces turned
 * into ". ", or null when it does not apply. Only after a letter or digit, so
 * "Done.  " or a run of spaces is left alone. The automatic capital then arms
 * for the next sentence on its own.
 */
export function doubleSpacePeriod(textBefore: string): string | null {
  if (!/[\p{L}\p{N}] {2}$/u.test(textBefore)) return null;
  return `${textBefore.slice(0, -2)}. `;
}
