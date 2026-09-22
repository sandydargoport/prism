/**
 * @jest-environment jsdom
 */
/**
 * The OS soft keyboard and Prism's on-screen keyboard must never both show
 * (#498). While Prism's keyboard serves a field, the field carries
 * inputmode="none", which tells the browser the page brings its own keyboard.
 * Everywhere Prism's keyboard does not apply (mouse, phone widths, keyboard
 * disabled) the field is left exactly as it was, so the OS keyboard still works.
 */
import React from 'react';
import { render, act } from '@testing-library/react';

let mockIsMobile = false;
jest.mock('../useIsMobile', () => ({ useIsMobile: () => mockIsMobile }));
jest.mock('../useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({ isListening: false, start: jest.fn(), stop: jest.fn() }),
}));
jest.mock('@/components/ui/use-toast', () => ({ toast: jest.fn() }));

import { GlobalInputProvider, useGlobalInput } from '../useGlobalInput';

let settingValue: unknown = null;

beforeEach(() => {
  mockIsMobile = false;
  settingValue = null;
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ value: settingValue }),
  })) as unknown as typeof fetch;
  window.scrollBy = jest.fn();
  window.scrollTo = jest.fn();
});

const probe: { ctx?: ReturnType<typeof useGlobalInput> } = {};
function Probe() {
  const value = useGlobalInput();
  React.useEffect(() => { probe.ctx = value; });
  return null;
}
/** The provider's context as of the last render. */
const ctx = new Proxy({} as ReturnType<typeof useGlobalInput>, {
  get: (_t, key) => probe.ctx![key as keyof ReturnType<typeof useGlobalInput>],
});

async function setup(inputProps: React.InputHTMLAttributes<HTMLInputElement> = {}) {
  const utils = render(
    <GlobalInputProvider>
      <Probe />
      <input data-testid="field" type="text" {...inputProps} />
      <input data-testid="other" type="text" />
      <div data-virtual-keyboard>
        <div data-testid="key" className="hg-button" data-skbtn="a" />
      </div>
    </GlobalInputProvider>,
  );
  // Let the settings fetch resolve.
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  return {
    field: utils.getByTestId('field') as HTMLInputElement,
    other: utils.getByTestId('other') as HTMLInputElement,
    key: utils.getByTestId('key'),
  };
}

function pointerDown(el: Element, pointerType: 'touch' | 'mouse') {
  const e = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  el.dispatchEvent(e);
}

/** A tap on a field: pointerdown, then the focus the browser gives it. */
function tap(el: HTMLElement, pointerType: 'touch' | 'mouse') {
  act(() => {
    pointerDown(el, pointerType);
    el.focus();
  });
}

describe('OS keyboard suppression (#498)', () => {
  it('marks a touched field inputmode="none" while Prism\'s keyboard serves it', async () => {
    const { field } = await setup();
    tap(field, 'touch');
    expect(ctx.keyboardVisible).toBe(true);
    expect(field.getAttribute('inputmode')).toBe('none');
  });

  it('sets inputmode on pointerdown, before the field takes focus', async () => {
    const { field } = await setup();
    act(() => { pointerDown(field, 'touch'); });
    expect(field.getAttribute('inputmode')).toBe('none');
  });

  it('removes the attribute on blur when the field had none', async () => {
    const { field } = await setup();
    tap(field, 'touch');
    act(() => { field.blur(); });
    expect(field.hasAttribute('inputmode')).toBe(false);
    expect(ctx.keyboardVisible).toBe(false);
  });

  it('puts back the exact inputmode the field had', async () => {
    const { field } = await setup({ inputMode: 'email' });
    tap(field, 'touch');
    expect(field.getAttribute('inputmode')).toBe('none');
    act(() => { field.blur(); });
    expect(field.getAttribute('inputmode')).toBe('email');
  });

  it('moves the suppression when focus moves to another field', async () => {
    const { field, other } = await setup();
    tap(field, 'touch');
    tap(other, 'touch');
    expect(field.hasAttribute('inputmode')).toBe(false);
    expect(other.getAttribute('inputmode')).toBe('none');
  });

  it('leaves a mouse-focused field alone', async () => {
    const { field } = await setup();
    tap(field, 'mouse');
    expect(ctx.keyboardVisible).toBe(false);
    expect(field.hasAttribute('inputmode')).toBe(false);
  });

  it('leaves the field alone at phone widths, where only the OS keyboard is used', async () => {
    mockIsMobile = true;
    const { field } = await setup();
    tap(field, 'touch');
    expect(ctx.keyboardVisible).toBe(false);
    expect(field.hasAttribute('inputmode')).toBe(false);
  });

  it('leaves the field alone when the on-screen keyboard is disabled in settings', async () => {
    settingValue = false;
    const { field } = await setup();
    tap(field, 'touch');
    expect(ctx.keyboardVisible).toBe(false);
    expect(field.hasAttribute('inputmode')).toBe(false);
  });

  it('suppresses the OS keyboard when opened from the toggle button', async () => {
    const { field } = await setup();
    tap(field, 'mouse');
    act(() => { ctx.setKeyboardVisible(true); });
    expect(field.getAttribute('inputmode')).toBe('none');
  });
});

describe('keyboard lifecycle around the suppression', () => {
  it('a key tap still keeps the field focused and the keyboard up (refocus guard)', async () => {
    const { field, key } = await setup();
    tap(field, 'touch');
    act(() => {
      pointerDown(key, 'touch');
      field.blur();
    });
    expect(document.activeElement).toBe(field);
    expect(ctx.keyboardVisible).toBe(true);
    expect(field.getAttribute('inputmode')).toBe('none');
  });

  it('re-tapping the focused field reopens Prism\'s keyboard after Enter closed it', async () => {
    const { field } = await setup();
    tap(field, 'touch');
    act(() => { ctx.setKeyboardVisible(false); }); // what the Enter key does
    expect(ctx.keyboardVisible).toBe(false);
    expect(document.activeElement).toBe(field);
    act(() => { pointerDown(field, 'touch'); });
    expect(ctx.keyboardVisible).toBe(true);
  });

  it('flags the document while open so CSS can lift dialogs, and only then', async () => {
    const { field } = await setup();
    const root = document.documentElement;
    expect(root.hasAttribute('data-virtual-keyboard-open')).toBe(false);
    tap(field, 'touch');
    expect(root.hasAttribute('data-virtual-keyboard-open')).toBe(true);
    expect(root.style.getPropertyValue('--keyboard-height')).toMatch(/^\d+(\.\d+)?px$/);
    act(() => { field.blur(); });
    expect(root.hasAttribute('data-virtual-keyboard-open')).toBe(false);
    expect(root.style.getPropertyValue('--keyboard-height')).toBe('0px');
  });
});
