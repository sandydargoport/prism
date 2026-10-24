'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { createPortal } from 'react-dom';
import Keyboard from 'simple-keyboard';
import 'simple-keyboard/build/css/index.css';
import { Mic, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalInput } from '@/lib/hooks/useGlobalInput';
import { useHydrated } from '@/lib/hooks/useStoredValue';
import { useResetOn } from '@/lib/hooks/useResetOn';
import {
  KEYBOARD_HEIGHT_VH,
  KEYBOARD_MAX_HEIGHT_PX,
  KEYBOARD_MIN_HEIGHT_PX,
} from '@/lib/input/keyboardLayout';
import {
  INITIAL_SHIFT_STATE,
  applyAutoShift,
  autoCapitalizeMode,
  doubleSpacePeriod,
  DOUBLE_SPACE_MS,
  consumeShift,
  autoShiftLayout,
  caretOf,
  fieldInfoFor,
  layoutNameFor,
  pressShiftKey,
  shouldAutoShift,
  textBeforeCaret,
  type ShiftState,
} from '@/lib/input/autoCapitalize';

const defaultRows = [
  '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
  '{tab} q w e r t y u i o p [ ] \\',
  '{lock} a s d f g h j k l ; \' {enter}',
  '{shift} z x c v b n m , . / {shift}',
  '{space} {mic} {dismiss}',
];

const layout = {
  default: defaultRows,
  // The one-shot automatic capital (#635): letters only, so digits and
  // punctuation are unaffected.
  autoshift: autoShiftLayout(defaultRows),
  shift: [
    '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
    '{tab} Q W E R T Y U I O P { } |',
    '{lock} A S D F G H J K L : " {enter}',
    '{shift} Z X C V B N M < > ? {shift}',
    '{space} {mic} {dismiss}',
  ],
};

const display = {
  '{bksp}': '⌫',
  '{enter}': '↵',
  '{shift}': '⇧',
  '{lock}': '⇪',
  '{tab}': '⇥',
  '{space}': ' ',
  '{mic}': '🎤',
  '{dismiss}': '↓',
};

export function VirtualKeyboard() {
  const {
    keyboardVisible,
    setKeyboardVisible,
    injectText,
    activeInputRef,
    activeContentEditableRef,
    isMobile,
    isListening,
    startListening,
    stopListening,
    declaredInputMode,
    activeField,
  } = useGlobalInput();

  const mounted = useHydrated();
  const [isExiting, setIsExiting] = useState(false);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<Keyboard | null>(null);
  const shiftRef = useRef<ShiftState>(INITIAL_SHIFT_STATE);
  // The field auto-shift last looked at, to tell a move to another field from
  // the refocus that follows a key tap.
  const autoShiftFieldRef = useRef<HTMLElement | null>(null);
  // Set while onChange injects a keystroke, so the input listener leaves that
  // one to onChange, which knows the keyboard's own caret.
  const injectingRef = useRef(false);
  const keyboardVisibleRef = useRef(keyboardVisible);
  useEffect(() => { keyboardVisibleRef.current = keyboardVisible; }, [keyboardVisible]);
  // isContentEditable is captured per-show so we don't need to re-init the keyboard
  const isContentEditableRef = useRef(false);

  // Stable refs for values used inside keyboard callbacks
  const injectTextRef = useLatestRef(injectText);
  const setKeyboardVisibleRef = useLatestRef(setKeyboardVisible);
  const isListeningRef = useLatestRef(isListening);
  const startListeningRef = useLatestRef(startListening);
  const stopListeningRef = useLatestRef(stopListening);
  const declaredInputModeRef = useLatestRef(declaredInputMode);

  // Double space for a full stop: when the last space was tapped, and whether
  // the space being applied now is the second of a pair.
  const lastSpaceAtRef = useRef(0);
  const doubleSpaceRef = useRef(false);
  /** Whether the active field wants sentence punctuation help at all. */
  const allowsDoubleSpace = (el: HTMLElement | null) =>
    !!el && autoCapitalizeMode(fieldInfoFor(el, declaredInputModeRef.current(el))) !== 'off';

  /** Apply a new shift state, re-rendering the keys only when the layout changes. */
  const setShiftState = useCallback((next: ShiftState) => {
    const before = layoutNameFor(shiftRef.current);
    shiftRef.current = next;
    const after = layoutNameFor(next);
    if (after !== before) keyboardRef.current?.setOptions({ layoutName: after });
  }, []);

  /**
   * The shift state for the caret in the active field, arming or dropping the
   * automatic capital (#635). `keyboardCaret` is simple-keyboard's caret after
   * a keystroke it applied; otherwise the field's own selection is read.
   */
  const autoShiftState = useCallback((keyboardCaret?: number | null): ShiftState => {
    const editable = activeContentEditableRef.current;
    const input = activeInputRef.current;
    const el = editable ?? input;
    autoShiftFieldRef.current = el;
    if (!el) return applyAutoShift(shiftRef.current, false);
    const info = fieldInfoFor(el, declaredInputModeRef.current(el));
    let wanted = false;
    if (editable) {
      const text = textBeforeCaret(editable);
      wanted = text !== null && shouldAutoShift(text, text.length, info);
    } else if (input) {
      const caret = keyboardCaret !== undefined ? keyboardCaret : caretOf(input);
      wanted = shouldAutoShift(input.value, caret, info);
    }
    return applyAutoShift(shiftRef.current, wanted);
  }, [activeInputRef, activeContentEditableRef, declaredInputModeRef]);
  const evaluateAutoShift = useCallback((keyboardCaret?: number | null) => {
    setShiftState(autoShiftState(keyboardCaret));
  }, [setShiftState, autoShiftState]);

  // Manage enter/exit animation: the phase changes in the render that sees
  // keyboardVisible change, and the effect only times the exit.
  useResetOn(keyboardVisible, () => {
    if (keyboardVisible) {
      setIsExiting(false);
      setVisible(true);
    } else if (visible) {
      setIsExiting(true);
    }
  });
  useEffect(() => {
    if (!isExiting) return;
    const t = setTimeout(() => { setVisible(false); setIsExiting(false); }, 200);
    return () => clearTimeout(t);
  }, [isExiting]);

  // Capture isContentEditable state and reset shift when keyboard becomes visible.
  // Always force the layout back to lowercase, or to the automatic capital when
  // the caret starts a sentence (#635). This prevents react-simple-keyboard from
  // getting stuck in a numeric layout when a numeric/password input had focus.
  useEffect(() => {
    if (keyboardVisible && keyboardRef.current) {
      isContentEditableRef.current = !!activeContentEditableRef.current;
      shiftRef.current = INITIAL_SHIFT_STATE;
      shiftRef.current = autoShiftState(); // one render, not two
      keyboardRef.current.setOptions({ layoutName: layoutNameFor(shiftRef.current), layout });
      keyboardRef.current.setInput(activeInputRef.current?.value ?? '');
    }
  }, [keyboardVisible, autoShiftState, activeInputRef, activeContentEditableRef]);

  // Auto-shift follows the caret: a tap that moves it, a move to another
  // field while the keyboard stays open, and text that arrives some other way
  // (voice, or a contenteditable keystroke) all re-evaluate it. The provider's
  // own document listeners run after these, so wait for them to settle.
  useEffect(() => {
    const inActiveField = (t: EventTarget | null) => {
      const el = activeContentEditableRef.current ?? activeInputRef.current;
      return !!el && t instanceof Node && el.contains(t);
    };
    const onFocusIn = () => {
      setTimeout(() => {
        if (!keyboardVisibleRef.current) return;
        const el = activeContentEditableRef.current ?? activeInputRef.current;
        if (!el || el === autoShiftFieldRef.current) return; // refocus after a key tap
        isContentEditableRef.current = !!activeContentEditableRef.current;
        keyboardRef.current?.setInput(activeInputRef.current?.value ?? '');
        evaluateAutoShift();
      }, 0);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!keyboardVisibleRef.current || !inActiveField(e.target)) return;
      setTimeout(() => { if (keyboardVisibleRef.current) evaluateAutoShift(); }, 0);
    };
    const onInput = (e: Event) => {
      if (injectingRef.current || !keyboardVisibleRef.current || !inActiveField(e.target)) return;
      evaluateAutoShift();
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('input', onInput);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('input', onInput);
    };
  }, [evaluateAutoShift, activeInputRef, activeContentEditableRef]);

  // Init simple-keyboard ONCE after mount — avoids expensive re-init on every show/hide.
  // On slow devices (Wyse 3040), re-initializing on every focus was causing noticeable lag.
  useEffect(() => {
    if (!mounted || !containerRef.current || keyboardRef.current) return;

    const kb = new Keyboard(containerRef.current, {
      onChange: (input) => {
        if (isContentEditableRef.current) return;
        if (doubleSpaceRef.current) {
          doubleSpaceRef.current = false;
          const caret = kb.getCaretPosition() ?? input.length;
          const period = allowsDoubleSpace(activeInputRef.current)
            ? doubleSpacePeriod(input.slice(0, caret))
            : null;
          if (period) {
            input = period + input.slice(caret);
            kb.setInput(input);
          }
        }
        injectingRef.current = true;
        try {
          injectTextRef.current(input);
        } finally {
          injectingRef.current = false;
        }
        evaluateAutoShift(kb.getCaretPosition());
      },
      onKeyPress: (button: string) => {
        if (button === '{space}') {
          const now = Date.now();
          doubleSpaceRef.current = now - lastSpaceAtRef.current < DOUBLE_SPACE_MS;
          // A third quick tap is a plain space again, not another full stop.
          lastSpaceAtRef.current = doubleSpaceRef.current ? 0 : now;
        } else {
          lastSpaceAtRef.current = 0;
          doubleSpaceRef.current = false;
        }
        if (button === '{shift}' || button === '{lock}') {
          setShiftState(pressShiftKey(shiftRef.current, button === '{shift}' ? 'shift' : 'lock'));
        } else if (!button.startsWith('{')) {
          // `button` is already the shifted character, so a one-shot Shift
          // can be cleared before the edit is applied.
          setShiftState(consumeShift(shiftRef.current));
        }
        const activeInput = activeInputRef.current;
        const activeContentEditable = activeContentEditableRef.current;
        if (button === '{enter}' && !isContentEditableRef.current && activeInput) {
          activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
          activeInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
          if (activeInput instanceof HTMLInputElement) {
            setKeyboardVisibleRef.current(false);
          }
        }
        if (button === '{dismiss}') {
          setKeyboardVisibleRef.current(false);
          activeContentEditable?.blur();
          activeInput?.blur();
        }
        if (button === '{mic}') {
          if (isListeningRef.current) { stopListeningRef.current(); } else { startListeningRef.current(); }
        }
        if (isContentEditableRef.current && activeContentEditable) {
          const el = activeContentEditable;
          if (button === '{bksp}') {
            el.focus();
            document.execCommand('delete');
          } else if (button === '{enter}') {
            el.focus();
            document.execCommand('insertParagraph');
          } else if (button === '{space}') {
            el.focus();
            const before = textBeforeCaret(el);
            if (doubleSpaceRef.current && before !== null && allowsDoubleSpace(el)
              && doubleSpacePeriod(`${before} `)) {
              document.execCommand('delete');
              document.execCommand('insertText', false, '. ');
            } else {
              document.execCommand('insertText', false, ' ');
            }
            doubleSpaceRef.current = false;
          } else if (button === '{tab}') {
            el.focus();
            document.execCommand('insertText', false, '\t');
          } else if (!button.startsWith('{')) {
            el.focus();
            document.execCommand('insertText', false, button);
          }
        }
      },
      layout,
      layoutName: 'default',
      display,
      physicalKeyboardHighlight: false,
      syncInstanceInputs: false,
      buttonTheme: [
        { class: 'key-action', buttons: '{bksp} {enter} {shift} {lock} {tab}' },
        { class: 'key-space', buttons: '{space}' },
        { class: 'key-mic', buttons: '{mic}' },
        { class: 'key-dismiss', buttons: '{dismiss}' },
      ],
    });

    keyboardRef.current = kb;

    return () => {
      kb.destroy();
      keyboardRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Sync keyboard value when active input changes
  useEffect(() => {
    if (keyboardRef.current) {
      keyboardRef.current.setInput(activeInputRef.current?.value ?? '');
    }
  });

  // From state, not the ref: focus can move from one field to another with the
  // keyboard open, and nothing else re-renders this then.
  const isPassword =
    activeField instanceof HTMLInputElement &&
    activeField.type === 'password';

  // A field on a full-screen overlay (the Babysitter Mode note box, #497) sits
  // above this keyboard's usual layer, so the keyboard opened behind it. Such a
  // field marks a container with data-keyboard-above-overlays and the keyboard
  // lifts for it alone; everywhere else the scanner sheets stay on top.
  const aboveOverlays = Boolean(activeField?.closest('[data-keyboard-above-overlays]'));

  if (!mounted || isMobile) return null;

  // Always render the container so the Keyboard instance stays alive.
  // Show/hide via CSS — avoids re-init cost on every focus event.
  return createPortal(
    <div
      data-virtual-keyboard
      className={cn(
        'fixed bottom-0 left-0 right-0',
        aboveOverlays ? 'z-9998' : 'z-9000',
        'bg-background border-t border-border shadow-2xl',
        isListening && 'is-listening',
        visible && (isExiting ? 'animate-keyboard-out' : 'animate-keyboard-in'),
      )}
      style={{
        // Same numbers the provider uses to lift the field above the keyboard.
        height: `${KEYBOARD_HEIGHT_VH}vh`,
        minHeight: KEYBOARD_MIN_HEIGHT_PX,
        maxHeight: KEYBOARD_MAX_HEIGHT_PX,
        display: visible ? undefined : 'none',
        // A Radix *modal* dialog (e.g. the Add-Message compose box) sets
        // pointer-events:none on everything outside its content. This keyboard
        // portals to <body>, outside the dialog, so without this it becomes
        // inert — taps fall straight through to the dialog backdrop and close it
        // instead of typing. Force interactivity so keys work over a modal.
        pointerEvents: 'auto',
      }}
      // Keep focus on the active input when a key is tapped. simple-keyboard
      // swallows the BUBBLING pointerdown before it reaches this container, so
      // the old bubble-phase preventDefault never ran on touch — the first tap
      // blurred the input, the global focusout handler hid the keyboard, and the
      // character was lost (mouse worked only because a bubbling mousedown still
      // arrived). Preventing default in the CAPTURE phase runs BEFORE
      // simple-keyboard's own handler, so it reliably stops the blur on touch and
      // mouse alike. simple-keyboard still receives the event (preventDefault
      // cancels only the focus/compat-event default, not propagation), so the key
      // press still registers. (#125)
      onPointerDownCapture={e => { e.preventDefault(); }}
      onMouseDownCapture={e => { e.preventDefault(); }}
    >
      <div
        ref={containerRef}
        className={cn('h-full', isPassword && '[&_.key-mic]:opacity-0 [&_.key-mic]:pointer-events-none')}
      />
    </div>,
    document.body,
  );
}
