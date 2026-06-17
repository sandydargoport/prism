'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Keyboard from 'simple-keyboard';
import 'simple-keyboard/build/css/index.css';
import { Mic, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalInput } from '@/lib/hooks/useGlobalInput';

const layout = {
  default: [
    '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
    '{tab} q w e r t y u i o p [ ] \\',
    '{lock} a s d f g h j k l ; \' {enter}',
    '{shift} z x c v b n m , . / {shift}',
    '{space} {mic} {dismiss}',
  ],
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
  } = useGlobalInput();

  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<Keyboard | null>(null);
  const shiftRef = useRef<'default' | 'shift'>('default');
  // isContentEditable is captured per-show so we don't need to re-init the keyboard
  const isContentEditableRef = useRef(false);

  // Stable refs for values used inside keyboard callbacks
  const injectTextRef = useRef(injectText);
  injectTextRef.current = injectText;
  const setKeyboardVisibleRef = useRef(setKeyboardVisible);
  setKeyboardVisibleRef.current = setKeyboardVisible;
  const activeInputRef2 = useRef(activeInputRef);
  activeInputRef2.current = activeInputRef;
  const activeContentEditableRef2 = useRef(activeContentEditableRef);
  activeContentEditableRef2.current = activeContentEditableRef;
  const isListeningRef = useRef(isListening);
  isListeningRef.current = isListening;
  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;
  const stopListeningRef = useRef(stopListening);
  stopListeningRef.current = stopListening;

  useEffect(() => { setMounted(true); }, []);

  // Manage enter/exit animation
  useEffect(() => {
    if (keyboardVisible) {
      setIsExiting(false);
      setVisible(true);
    } else if (visible) {
      setIsExiting(true);
      const t = setTimeout(() => { setVisible(false); setIsExiting(false); }, 200);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardVisible]);

  // Capture isContentEditable state and reset shift when keyboard becomes visible.
  // Always force layoutName back to 'default' — prevents react-simple-keyboard from
  // getting stuck in a numeric layout when a numeric/password input had focus.
  useEffect(() => {
    if (keyboardVisible && keyboardRef.current) {
      isContentEditableRef.current = !!activeContentEditableRef2.current.current;
      shiftRef.current = 'default';
      keyboardRef.current.setOptions({ layoutName: 'default', layout });
      keyboardRef.current.setInput(activeInputRef2.current.current?.value ?? '');
    }
  }, [keyboardVisible]);

  // Init simple-keyboard ONCE after mount — avoids expensive re-init on every show/hide.
  // On slow devices (Wyse 3040), re-initializing on every focus was causing noticeable lag.
  useEffect(() => {
    if (!mounted || !containerRef.current || keyboardRef.current) return;

    const kb = new Keyboard(containerRef.current, {
      onChange: (input) => {
        if (!isContentEditableRef.current) injectTextRef.current(input);
      },
      onKeyPress: (button: string) => {
        if (button === '{shift}' || button === '{lock}') {
          const next = shiftRef.current === 'default' ? 'shift' : 'default';
          shiftRef.current = next;
          kb.setOptions({ layoutName: next });
        }
        const activeInput = activeInputRef2.current.current;
        const activeContentEditable = activeContentEditableRef2.current.current;
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
            document.execCommand('insertText', false, ' ');
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

  const isPassword =
    activeInputRef.current instanceof HTMLInputElement &&
    activeInputRef.current.type === 'password';

  if (!mounted || isMobile) return null;

  // Always render the container so the Keyboard instance stays alive.
  // Show/hide via CSS — avoids re-init cost on every focus event.
  return createPortal(
    <div
      data-virtual-keyboard
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[9000]',
        'bg-background border-t border-border shadow-2xl',
        isListening && 'is-listening',
        visible && (isExiting ? 'animate-keyboard-out' : 'animate-keyboard-in'),
      )}
      style={{
        height: '38vh', minHeight: 320, maxHeight: 480,
        display: visible ? undefined : 'none',
      }}
      onPointerDown={e => { e.stopPropagation(); e.preventDefault(); }}
      // simple-keyboard stops the pointerdown before it reaches this container,
      // so the preventDefault above never runs and the active input loses focus
      // on any key tap (Shift/symbols) — the global focusout handler then reads
      // that as "done" and hides the keyboard. The mousedown still bubbles here;
      // preventing its default keeps focus on the input so tapping keys no longer
      // dismisses the keyboard. (#125)
      onMouseDown={e => { e.preventDefault(); }}
    >
      <div
        ref={containerRef}
        className={cn('h-full', isPassword && '[&_.key-mic]:opacity-0 [&_.key-mic]:pointer-events-none')}
      />
    </div>,
    document.body,
  );
}
