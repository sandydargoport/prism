/**
 * @jest-environment jsdom
 */
/**
 * Auto-capitalization wired into the on-screen keyboard (#635), driven through
 * the real simple-keyboard instance: the capital is armed at the start of a
 * field, drops after one letter, comes back after a sentence, stays out of
 * fields that opt out, and gives way to the user's own Shift.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { VirtualKeyboard } from '../VirtualKeyboard';

jest.mock('simple-keyboard/build/css/index.css', () => ({}), { virtual: true });

type Field = HTMLInputElement | HTMLTextAreaElement;
const ctx = {
  keyboardVisible: false,
  setKeyboardVisible: jest.fn(),
  injectText: (value: string) => {
    const el = ctx.activeInputRef.current;
    if (!el) return;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  },
  activeInputRef: { current: null as Field | null },
  activeContentEditableRef: { current: null as HTMLElement | null },
  isMobile: false,
  isListening: false,
  startListening: jest.fn(),
  stopListening: jest.fn(),
  declaredInputMode: (el: HTMLElement) => el.getAttribute('inputmode'),
};
jest.mock('@/lib/hooks/useGlobalInput', () => ({ useGlobalInput: () => ctx }));

/** The label simple-keyboard currently shows for a key. */
function keyLabel(skbtn: string): string | null {
  return document.querySelector(`[data-virtual-keyboard] [data-skbtn="${skbtn}"]`)?.textContent ?? null;
}
function hasKey(skbtn: string): boolean {
  return !!document.querySelector(`[data-virtual-keyboard] [data-skbtn="${skbtn}"]`);
}
function tap(skbtn: string) {
  const btn = document.querySelector(`[data-virtual-keyboard] [data-skbtn="${skbtn}"]`);
  if (!btn) throw new Error(`no key ${skbtn}`);
  act(() => { fireEvent.click(btn); });
}
/** Tap each letter's key in whichever case the keyboard is showing. */
function typeText(chars: string) {
  for (const ch of chars) {
    if (ch === ' ') tap('{space}');
    else if (/[a-z]/i.test(ch)) tap(hasKey(ch.toLowerCase()) ? ch.toLowerCase() : ch.toUpperCase());
    else tap(ch);
  }
}

function openFor(field: Field) {
  ctx.activeInputRef.current = field;
  field.focus();
  const view = render(<VirtualKeyboard />);
  ctx.keyboardVisible = true;
  view.rerender(<VirtualKeyboard />);
  return view;
}

afterEach(() => {
  ctx.keyboardVisible = false;
  ctx.activeInputRef.current = null;
  document.body.innerHTML = '';
});

function makeField(html: string): Field {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  document.body.appendChild(wrap);
  return wrap.firstElementChild as Field;
}

describe('VirtualKeyboard auto-capitalization', () => {
  it('capitalizes the first letter of a field, then drops to lowercase', () => {
    const field = makeField('<input type="text">');
    openFor(field);
    expect(hasKey('B')).toBe(true);
    // Digits are untouched by the automatic capital.
    expect(hasKey('3')).toBe(true);
    typeText('buy milk');
    expect(field.value).toBe('Buy milk');
    expect(hasKey('b')).toBe(true);
  });

  it('capitalizes again after a sentence ends', () => {
    const field = makeField('<textarea></textarea>');
    openFor(field);
    typeText('done. next');
    expect(field.value).toBe('Done. Next');
  });

  it('re-arms when backspace empties the field', () => {
    const field = makeField('<input type="text">');
    openFor(field);
    typeText('a');
    expect(hasKey('q')).toBe(true);
    tap('{bksp}');
    expect(field.value).toBe('');
    expect(hasKey('Q')).toBe(true);
  });

  it('types a digit, not a symbol, at the start of a field', () => {
    const field = makeField('<input type="text">');
    openFor(field);
    typeText('3 eggs');
    expect(field.value).toBe('3 eggs');
  });

  it('leaves fields that opt out alone', () => {
    for (const html of [
      '<input type="email">',
      '<input type="password">',
      '<input type="search">',
      '<input type="text" autocapitalize="none">',
    ]) {
      const field = makeField(html);
      const view = openFor(field);
      expect(hasKey('q')).toBe(true);
      view.unmount();
      ctx.keyboardVisible = false;
      document.body.innerHTML = '';
    }
  });

  it('Shift while the capital is armed types a lowercase letter', () => {
    const field = makeField('<input type="text">');
    openFor(field);
    tap('{shift}');
    expect(hasKey('q')).toBe(true);
    typeText('ok');
    expect(field.value).toBe('ok');
  });

  it('Shift gives one capital, then lowercase again, as on a phone', () => {
    const field = makeField('<input type="text">');
    openFor(field);
    typeText('a ');
    tap('{shift}');
    typeText('bc');
    expect(field.value).toBe('A Bc');
  });

  it('a quick double space types a full stop and capitalizes the next word', () => {
    const field = makeField('<input type="text">');
    openFor(field);
    typeText('ok');
    tap('{space}');
    tap('{space}');
    expect(field.value).toBe('Ok. ');
    typeText('next');
    expect(field.value).toBe('Ok. Next');
  });

  it('two slow spaces stay two spaces', () => {
    const now = jest.spyOn(Date, 'now');
    try {
      const field = makeField('<input type="text">');
      openFor(field);
      typeText('ok');
      now.mockReturnValue(1_000);
      tap('{space}');
      now.mockReturnValue(2_000);
      tap('{space}');
      expect(field.value).toBe('Ok  ');
    } finally {
      now.mockRestore();
    }
  });

  it('no full stop in a field that opts out, such as a search box', () => {
    const field = makeField('<input type="text" autocapitalize="none">');
    openFor(field);
    typeText('ok');
    tap('{space}');
    tap('{space}');
    expect(field.value).toBe('ok  ');
  });

  it("the user's Caps Lock wins over the automatic lowercase", () => {
    const field = makeField('<input type="text">');
    openFor(field);
    tap('{lock}');
    typeText('ok');
    expect(field.value).toBe('OK');
    expect(keyLabel('~')).toBe('~'); // still the shift layout
  });
});
