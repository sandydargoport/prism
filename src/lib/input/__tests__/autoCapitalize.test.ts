/**
 * @jest-environment jsdom
 */
/**
 * Auto-capitalization on the on-screen keyboard (#635): when the next letter
 * should be a capital, which fields opt out, and how the user's own Shift and
 * Caps Lock interact with the automatic one.
 */
import {
  INITIAL_SHIFT_STATE,
  applyAutoShift,
  consumeShift,
  doubleSpacePeriod,
  autoCapitalizeMode,
  autoShiftLayout,
  fieldInfoFor,
  layoutNameFor,
  pressShiftKey,
  shouldAutoShift,
  textBeforeCaret,
  type FieldInfo,
} from '../autoCapitalize';

const text: FieldInfo = { kind: 'input', type: 'text' };
const area: FieldInfo = { kind: 'textarea' };

describe('shouldAutoShift', () => {
  it('capitalizes at the start of an empty field', () => {
    expect(shouldAutoShift('', 0, text)).toBe(true);
    expect(shouldAutoShift('', null, area)).toBe(true);
  });

  it('drops back to lowercase after the first letter', () => {
    expect(shouldAutoShift('B', 1, text)).toBe(false);
    expect(shouldAutoShift('Buy milk', null, text)).toBe(false);
  });

  it('capitalizes after a sentence ends and a space follows', () => {
    expect(shouldAutoShift('Buy milk. ', null, text)).toBe(true);
    expect(shouldAutoShift('Done! ', null, text)).toBe(true);
    expect(shouldAutoShift('Ready? ', null, text)).toBe(true);
    expect(shouldAutoShift('She said "go." ', null, text)).toBe(true);
    expect(shouldAutoShift('(Back soon.) ', null, text)).toBe(true);
  });

  it('waits for the space after the punctuation', () => {
    expect(shouldAutoShift('Buy milk.', null, text)).toBe(false);
  });

  it('does not capitalize after a comma, a decimal point or mid-word', () => {
    expect(shouldAutoShift('Eggs, ', null, text)).toBe(false);
    expect(shouldAutoShift('Costs 3.5', null, text)).toBe(false);
    expect(shouldAutoShift('Hello ', null, text)).toBe(false);
  });

  it('capitalizes at the start of a line', () => {
    expect(shouldAutoShift('First line\n', null, area)).toBe(true);
    expect(shouldAutoShift('First line\n  ', null, area)).toBe(true);
  });

  it('reads the text before the caret, not the end of the value', () => {
    const value = 'Call the vet. tomorrow';
    expect(shouldAutoShift(value, 'Call the vet. '.length, text)).toBe(true);
    expect(shouldAutoShift(value, 0, text)).toBe(true);
    expect(shouldAutoShift(value, 4, text)).toBe(false);
  });

  it('clamps a caret beyond the value', () => {
    expect(shouldAutoShift('Hi. ', 99, text)).toBe(true);
    expect(shouldAutoShift('Hi', -3, text)).toBe(true);
  });

  it('treats a field holding only whitespace as its start', () => {
    expect(shouldAutoShift('  ', null, text)).toBe(true);
  });

  it('honours autocapitalize="words" and "characters"', () => {
    const words = { ...text, autocapitalize: 'words' };
    expect(shouldAutoShift('Maple ', null, words)).toBe(true);
    expect(shouldAutoShift('Maple', null, words)).toBe(false);
    const chars = { ...text, autocapitalize: 'characters' };
    expect(shouldAutoShift('AB', null, chars)).toBe(true);
  });

  it('never capitalizes in a field that opts out', () => {
    expect(shouldAutoShift('', 0, { kind: 'input', type: 'password' })).toBe(false);
    expect(shouldAutoShift('', 0, { ...text, autocapitalize: 'off' })).toBe(false);
  });
});

describe('autoCapitalizeMode', () => {
  it.each(['password', 'email', 'url', 'number', 'tel'])('is off for type=%s', type => {
    expect(autoCapitalizeMode({ kind: 'input', type })).toBe('off');
  });

  it('keeps those types off even when the attribute asks otherwise', () => {
    expect(autoCapitalizeMode({ kind: 'input', type: 'email', autocapitalize: 'sentences' })).toBe('off');
  });

  it('is off for search boxes unless the field asks for it', () => {
    expect(autoCapitalizeMode({ kind: 'input', type: 'search' })).toBe('off');
    expect(autoCapitalizeMode({ kind: 'input', type: 'search', autocapitalize: 'sentences' })).toBe('sentences');
  });

  it.each(['off', 'none', 'NONE'])('is off for autocapitalize="%s"', value => {
    expect(autoCapitalizeMode({ ...text, autocapitalize: value })).toBe('off');
  });

  it('treats "on" as sentences and ignores unknown values', () => {
    expect(autoCapitalizeMode({ ...text, autocapitalize: 'on' })).toBe('sentences');
    expect(autoCapitalizeMode({ ...text, autocapitalize: 'shout' })).toBe('sentences');
    expect(autoCapitalizeMode({ ...text, autocapitalize: '' })).toBe('sentences');
  });

  it.each(['numeric', 'decimal', 'tel', 'email', 'url'])('is off for inputmode="%s"', inputMode => {
    expect(autoCapitalizeMode({ ...text, inputMode })).toBe('off');
  });

  it('is off for usernames and one-time codes', () => {
    expect(autoCapitalizeMode({ ...text, autocomplete: 'username' })).toBe('off');
    expect(autoCapitalizeMode({ ...text, autocomplete: 'section-login username' })).toBe('off');
    expect(autoCapitalizeMode({ ...text, autocomplete: 'one-time-code' })).toBe('off');
    expect(autoCapitalizeMode({ ...text, autocomplete: 'tel-national' })).toBe('off');
    expect(autoCapitalizeMode({ ...text, autocomplete: 'off' })).toBe('sentences');
  });

  it('defaults to sentences for text, textarea and contenteditable', () => {
    expect(autoCapitalizeMode(text)).toBe('sentences');
    expect(autoCapitalizeMode(area)).toBe('sentences');
    expect(autoCapitalizeMode({ kind: 'contenteditable' })).toBe('sentences');
  });
});

describe('shift state', () => {
  const armed = applyAutoShift(INITIAL_SHIFT_STATE, true);

  it('arms the automatic capital and its layout', () => {
    expect(armed.auto).toBe(true);
    expect(layoutNameFor(armed)).toBe('autoshift');
    expect(layoutNameFor(applyAutoShift(armed, false))).toBe('default');
  });

  it('Shift while armed turns it off for this letter', () => {
    const cancelled = pressShiftKey(armed, 'shift');
    expect(layoutNameFor(cancelled)).toBe('default');
    expect(cancelled.autoCancelled).toBe(true);
    // The next edit or caret move evaluates afresh.
    expect(layoutNameFor(applyAutoShift(cancelled, true))).toBe('autoshift');
  });

  it('Caps Lock while armed locks capitals on', () => {
    const locked = pressShiftKey(armed, 'lock');
    expect(locked.manual).toBe(true);
    expect(layoutNameFor(locked)).toBe('shift');
  });

  it('a manual Shift wins over the automatic one until a character uses it up', () => {
    let s = pressShiftKey(INITIAL_SHIFT_STATE, 'shift');
    expect(layoutNameFor(s)).toBe('shift');
    s = applyAutoShift(s, false);
    expect(layoutNameFor(s)).toBe('shift');
    s = consumeShift(s);
    expect(layoutNameFor(applyAutoShift(s, false))).toBe('default');
  });

  it('Caps Lock is not used up by a character', () => {
    let s = pressShiftKey(INITIAL_SHIFT_STATE, 'lock');
    s = applyAutoShift(consumeShift(s), false);
    expect(layoutNameFor(s)).toBe('shift');
    expect(layoutNameFor(pressShiftKey(s, 'shift'))).toBe('default');
  });

  it('turning a manual Shift off does not bring the automatic one straight back', () => {
    const on = pressShiftKey(INITIAL_SHIFT_STATE, 'lock');
    const off = pressShiftKey(on, 'lock');
    expect(off.manual).toBe(false);
    expect(layoutNameFor(off)).toBe('default');
  });

  it('a second Shift after cancelling turns the manual shift on', () => {
    const cancelled = pressShiftKey(armed, 'shift');
    expect(layoutNameFor(pressShiftKey(cancelled, 'shift'))).toBe('shift');
  });
});

describe('autoShiftLayout', () => {
  it('uppercases letters only', () => {
    expect(autoShiftLayout(['` 1 2 {bksp}', '{tab} q w [ ]', '{shift} z , . / {shift}'])).toEqual([
      '` 1 2 {bksp}',
      '{tab} Q W [ ]',
      '{shift} Z , . / {shift}',
    ]);
  });
});

describe('fieldInfoFor', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('reads type, autocapitalize, autocomplete and the declared inputmode', () => {
    document.body.innerHTML = '<input type="TEXT" autocapitalize="words" autocomplete="name" inputmode="none">';
    const el = document.querySelector('input')!;
    expect(fieldInfoFor(el, 'numeric')).toEqual({
      kind: 'input', type: 'text', autocapitalize: 'words', inputMode: 'numeric', autocomplete: 'name',
    });
  });

  it("falls back to the form's autocapitalize", () => {
    document.body.innerHTML = '<form autocapitalize="off"><textarea></textarea></form>';
    const info = fieldInfoFor(document.querySelector('textarea')!);
    expect(info.kind).toBe('textarea');
    expect(autoCapitalizeMode(info)).toBe('off');
  });

  it('describes a contenteditable host', () => {
    document.body.innerHTML = '<div contenteditable="true" autocapitalize="none"></div>';
    const info = fieldInfoFor(document.querySelector('div')!);
    expect(info).toMatchObject({ kind: 'contenteditable', autocapitalize: 'none' });
  });
});

describe('textBeforeCaret', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  function caretAt(node: Node, offset: number) {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  it('returns the text up to the caret', () => {
    document.body.innerHTML = '<div id="h">Pack lunch. Then go</div>';
    const host = document.getElementById('h')!;
    caretAt(host.firstChild!, 'Pack lunch. '.length);
    expect(textBeforeCaret(host)).toBe('Pack lunch. ');
  });

  it('marks the start of a new block as a line start', () => {
    document.body.innerHTML = '<div id="h"><div>First note</div><div>x</div></div>';
    const host = document.getElementById('h')!;
    caretAt(host.lastChild!.firstChild!, 0);
    const before = textBeforeCaret(host)!;
    expect(before).toBe('First note\n');
    expect(shouldAutoShift(before, before.length, { kind: 'contenteditable' })).toBe(true);
  });

  it('marks the node after a <br> as a line start', () => {
    document.body.innerHTML = '<div id="h">First note<br>x</div>';
    const host = document.getElementById('h')!;
    caretAt(host.lastChild!, 0);
    expect(textBeforeCaret(host)).toBe('First note\n');
  });

  it('is null when the selection is elsewhere', () => {
    document.body.innerHTML = '<div id="h">Note</div><p id="o">Other</p>';
    caretAt(document.getElementById('o')!.firstChild!, 2);
    expect(textBeforeCaret(document.getElementById('h')!)).toBeNull();
  });
});

describe('doubleSpacePeriod', () => {
  it('turns a double space after a word into a full stop and a space', () => {
    expect(doubleSpacePeriod('buy milk  ')).toBe('buy milk. ');
    expect(doubleSpacePeriod('room 12  ')).toBe('room 12. ');
  });

  it('leaves it alone after punctuation, a single space, or only spaces', () => {
    expect(doubleSpacePeriod('done.  ')).toBeNull();
    expect(doubleSpacePeriod('buy ')).toBeNull();
    expect(doubleSpacePeriod('  ')).toBeNull();
    expect(doubleSpacePeriod('buy   ')).toBeNull();
  });
});
