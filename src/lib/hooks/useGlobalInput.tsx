'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useIsMobile } from './useIsMobile';
import { useSpeechRecognition } from './useSpeechRecognition';
import { toast } from '@/components/ui/use-toast';
import { isVirtualKeyboardTarget } from '@/lib/input/keyboardTarget';
import {
  keyboardHeightPx,
  restoreReveal,
  revealAboveKeyboard,
  type RevealRecord,
} from '@/lib/input/keyboardLayout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlobalInputContextValue {
  keyboardVisible: boolean;
  isListening: boolean;
  isInputFocused: boolean;
  isMobile: boolean;
  activeInputRef: React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  activeContentEditableRef: React.MutableRefObject<HTMLElement | null>;
  setKeyboardVisible: (visible: boolean) => void;
  setIsListening: (v: boolean) => void;
  injectText: (text: string) => void;
  startListening: () => void;
  stopListening: () => void;
  virtualKeyboardEnabled: boolean;
}

const GlobalInputContext = createContext<GlobalInputContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shouldShowKeyboard(el: Element): boolean {
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  if (el instanceof HTMLInputElement) {
    return ['text', 'search', 'email', 'password'].includes(el.type.toLowerCase());
  }
  return true; // textarea
}

function isInsideKeyboard(el: Element): boolean {
  return isVirtualKeyboardTarget(el);
}

/** The element that takes focus for `el`: itself, or its contenteditable host. */
function editableHost(el: Element): HTMLElement | null {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el;
  if (!(el instanceof HTMLElement) || !el.isContentEditable) return null;
  let host: HTMLElement = el;
  while (host.parentElement?.isContentEditable) host = host.parentElement;
  return host;
}

function isRealKeyboardEvent(e: KeyboardEvent): boolean {
  if (!e.isTrusted) return false;
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function GlobalInputProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [keyboardVisible, setKeyboardVisibleState] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const activeContentEditableRef = useRef<HTMLElement | null>(null);
  // Scroll and padding changes made to lift the field above the keyboard (#499).
  const revealRecordsRef = useRef<RevealRecord[]>([]);
  // The field currently carrying inputmode="none", and its attribute before.
  // While Prism's keyboard serves a field, the OS soft keyboard must stay down
  // or both appear stacked (#498). inputmode="none" is the standard way to tell
  // the browser a page supplies its own keyboard.
  const osKeyboardSuppressedRef = useRef<{ el: HTMLElement; prev: string | null } | null>(null);
  const suppressedForScan = useRef(false);
  const lastPointerTypeRef = useRef<'touch' | 'mouse' | 'keyboard'>('mouse');
  const textInjectedWhileOpen = useRef(false);
  // True while the most recent pointerdown landed on the virtual keyboard. The
  // durable guard against the recurring "first key tap dismisses the keyboard"
  // bug (#125/#135/#234): keyboard keys are non-focusable divs, so tapping one
  // blurs the input with a null relatedTarget and the focusout handler used to
  // tear the keyboard down. We instead detect the keyboard-origin blur here and
  // restore focus, independent of preventDefault (which simple-keyboard defeats)
  // and of relatedTarget (always null for div keys). See global-input-system.md.
  const pointerOnKeyboardRef = useRef(false);
  const keyboardVisibleRef = useRef(false);

  // Read virtual keyboard setting (default enabled)
  const [virtualKeyboardEnabled, setVirtualKeyboardEnabled] = useState(true);
  useEffect(() => {
    fetch('/api/settings?key=input.virtualKeyboardEnabled')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.value === false) setVirtualKeyboardEnabled(false);
      })
      .catch(() => {});
  }, []);

  // ---- injectText ----
  const injectText = useCallback((text: string) => {
    const input = activeInputRef.current;
    if (!input) return;
    const proto = input instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (!setter) return;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    textInjectedWhileOpen.current = true;
  }, []);

  // Mirror keyboardVisible into a ref so the document event handlers (bound once)
  // can read the live value without re-binding.
  useEffect(() => { keyboardVisibleRef.current = keyboardVisible; }, [keyboardVisible]);

  // ---- audio feedback ----
  const playBeep = useCallback(async () => {
    try {
      const settingsRes = await fetch('/api/settings?key=scanner.soundEnabled');
      const s = settingsRes.ok ? await settingsRes.json() : null;
      if (s?.value === false) return;
      const styleRes = await fetch('/api/settings?key=scanner.soundStyle');
      const styleData = styleRes.ok ? await styleRes.json() : null;
      const style: string = styleData?.value ?? 'beep';

      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = style === 'scan' ? 1800 : 1200;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (style === 'scan' ? 0.08 : 0.15));
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch { /* ignore autoplay policy errors */ }
  }, []);

  // ---- barcode scan dispatch ----
  const dispatchScan = useCallback(async (barcode: string) => {
    suppressedForScan.current = true;
    setTimeout(() => { suppressedForScan.current = false; }, 500);
    playBeep();

    try {
      const res = await fetch('/api/shopping/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      });
      const data = await res.json() as {
        found: boolean;
        item?: { name: string };
        action?: string;
        itemId?: string;
        listId?: string;
      };

      if (!data.found) {
        toast({ title: `Unknown barcode`, description: `No product found for ${barcode}` });
        return;
      }

      // Notify shopping page if open
      window.dispatchEvent(new CustomEvent('prism:scan-result', { detail: data }));

      const isOnShopping = window.location.pathname.startsWith('/shopping');
      toast({
        title: data.action === 'updated_existing'
          ? `${data.item!.name} already on list`
          : `${data.item!.name} added`,
        description: isOnShopping ? undefined : 'View shopping list',
      });
    } catch {
      toast({ title: 'Scan failed', variant: 'destructive' });
    }
  }, [playBeep]);

  // ---- speech recognition ----
  const handleSpeechResult = useCallback((transcript: string) => {
    const editable = activeContentEditableRef.current;
    if (editable) {
      editable.focus();
      document.execCommand('insertText', false, transcript);
      textInjectedWhileOpen.current = true;
      return;
    }
    const input = activeInputRef.current;
    if (!input) return;
    const current = input.value;
    const sep = current.length > 0 && !current.endsWith(' ') ? ' ' : '';
    injectText(current + sep + transcript);
  }, [injectText]);

  const speech = useSpeechRecognition(handleSpeechResult);

  // ---- OS keyboard suppression (#498) ----
  const releaseOsKeyboard = useCallback(() => {
    const s = osKeyboardSuppressedRef.current;
    if (!s) return;
    osKeyboardSuppressedRef.current = null;
    if (s.prev === null) s.el.removeAttribute('inputmode');
    else s.el.setAttribute('inputmode', s.prev);
  }, []);

  const suppressOsKeyboard = useCallback((el: HTMLElement) => {
    if (osKeyboardSuppressedRef.current?.el === el) return;
    releaseOsKeyboard();
    osKeyboardSuppressedRef.current = { el, prev: el.getAttribute('inputmode') };
    el.setAttribute('inputmode', 'none');
  }, [releaseOsKeyboard]);

  // ---- scroll helpers (#499) ----
  const releaseView = useCallback((restorePosition: boolean) => {
    restoreReveal(revealRecordsRef.current, restorePosition);
    revealRecordsRef.current = [];
  }, []);

  const scrollInputIntoView = useCallback((el: Element) => {
    // Moving to another field while the keyboard stays open: drop the old
    // padding but leave the view where it is.
    releaseView(false);
    const keyboardTop = window.innerHeight - keyboardHeightPx(window.innerHeight);
    revealRecordsRef.current = revealAboveKeyboard(el, keyboardTop);
  }, [releaseView]);

  // ---- setKeyboardVisible (public) ----
  const setKeyboardVisible = useCallback((visible: boolean) => {
    setKeyboardVisibleState(visible);
    if (visible) {
      textInjectedWhileOpen.current = false;
      // Opened from the toggle button on a field focused without touch.
      const el = activeContentEditableRef.current ?? activeInputRef.current;
      if (el) suppressOsKeyboard(el);
    } else {
      // Explicit close (↓ dismiss / Enter). Clear the keyboard-tap flag so the
      // blur those keys trigger isn't caught by the focusout refocus guard,
      // which would otherwise immediately reopen the keyboard.
      pointerOnKeyboardRef.current = false;
      releaseView(!textInjectedWhileOpen.current);
      textInjectedWhileOpen.current = false;
    }
  }, [releaseView, suppressOsKeyboard]);

  // ---- keyboard height CSS var, and lifting the field above it ----
  // `data-virtual-keyboard-open` + `--keyboard-height` let CSS move dialogs
  // into the space above the keyboard (globals.css). Both are set before the
  // reveal so it measures the dialog in its lifted position.
  useEffect(() => {
    const root = document.documentElement;
    if (!keyboardVisible) {
      root.style.setProperty('--keyboard-height', '0px');
      root.removeAttribute('data-virtual-keyboard-open');
      return;
    }
    const applyHeight = () => {
      root.style.setProperty('--keyboard-height', `${keyboardHeightPx(window.innerHeight)}px`);
    };
    applyHeight();
    root.setAttribute('data-virtual-keyboard-open', '');
    const el = activeContentEditableRef.current ?? activeInputRef.current;
    if (el) scrollInputIntoView(el);
    window.addEventListener('resize', applyHeight);
    return () => window.removeEventListener('resize', applyHeight);
  }, [keyboardVisible, scrollInputIntoView]);

  // Put the field's own inputmode back if the provider goes away.
  useEffect(() => releaseOsKeyboard, [releaseOsKeyboard]);

  // ---- barcode buffer ----
  const barcodeBuffer = useRef<{ char: string; time: number }[]>([]);

  // ---- document event listeners ----
  useEffect(() => {
    const prismKeyboardApplies = () =>
      lastPointerTypeRef.current === 'touch' &&
      !isMobile &&
      !suppressedForScan.current &&
      virtualKeyboardEnabled;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        lastPointerTypeRef.current = 'touch';
      } else if (e.pointerType === 'mouse') {
        lastPointerTypeRef.current = 'mouse';
      }
      const t = e.target;
      pointerOnKeyboardRef.current = t instanceof Element && isInsideKeyboard(t);

      // A touch on a field Prism's keyboard will serve. Set inputmode="none"
      // now, BEFORE the field takes focus, so the OS keyboard never starts to
      // open (#498).
      if (e.pointerType !== 'touch' || !(t instanceof Element) || !shouldShowKeyboard(t)) return;
      if (!prismKeyboardApplies()) return;
      const host = editableHost(t);
      if (!host) return;
      suppressOsKeyboard(host);
      // Re-tapping the field that already has focus (the keyboard was closed
      // by Enter, or by a physical key) fires no focusin. With the OS keyboard
      // suppressed, reopen Prism's here, or the tap would bring up nothing.
      const active = activeContentEditableRef.current ?? activeInputRef.current;
      if (host === active && document.activeElement === host && !keyboardVisibleRef.current) {
        textInjectedWhileOpen.current = false;
        setKeyboardVisibleState(true);
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element;
      const previous = activeContentEditableRef.current ?? activeInputRef.current;
      if (!shouldShowKeyboard(target)) {
        releaseOsKeyboard();
        activeInputRef.current = null;
        activeContentEditableRef.current = null;
        setIsInputFocused(false);
        setKeyboardVisibleState(false);
        return;
      }
      if (target instanceof HTMLElement && target.isContentEditable) {
        activeContentEditableRef.current = target;
        activeInputRef.current = null;
      } else {
        activeInputRef.current = target as HTMLInputElement | HTMLTextAreaElement;
        activeContentEditableRef.current = null;
      }
      setIsInputFocused(true);
      if (prismKeyboardApplies()) {
        const host = editableHost(target);
        if (host) suppressOsKeyboard(host);
        const wasVisible = keyboardVisibleRef.current;
        setKeyboardVisibleState(true);
        // Opening: the keyboardVisible effect lifts the field. Already open:
        // lift it here, unless this focusin is the restore-focus that follows
        // a key tap, where the field is already in place.
        if (wasVisible && target !== previous) scrollInputIntoView(target);
      } else {
        // Mouse, phone width, keyboard disabled: leave the OS keyboard alone.
        releaseOsKeyboard();
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Element | null;
      const from = e.target as Element | null;
      // Only react when the element LOSING focus is the input we're tracking.
      // Otherwise this global handler fires on every unrelated focus move — e.g.
      // Radix Select cycling focus across its options — and repeatedly hides the
      // keyboard / restores scroll, which nudges the list under the finger and
      // makes option taps land a row off ("sometimes clicks past it").
      if (from !== activeInputRef.current && from !== activeContentEditableRef.current) return;
      // Focus moved to a focusable keyboard control — keep the keyboard open.
      if (next && isInsideKeyboard(next)) return;
      // Tapping a (non-focusable) key blurs the input with a null relatedTarget.
      // Restore focus and keep the keyboard open instead of tearing it down.
      if (pointerOnKeyboardRef.current) {
        const el = activeContentEditableRef.current ?? activeInputRef.current;
        if (el) { el.focus({ preventScroll: true }); return; }
      }
      releaseOsKeyboard();
      activeInputRef.current = null;
      activeContentEditableRef.current = null;
      setIsInputFocused(false);
      setKeyboardVisibleState(false);
      releaseView(!textInjectedWhileOpen.current);
      textInjectedWhileOpen.current = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Physical keyboard auto-dismiss
      if (isRealKeyboardEvent(e)) {
        setKeyboardVisibleState(false);
      }

      // Barcode scanner detection
      if (e.key === 'Enter') {
        const buf = barcodeBuffer.current;
        if (buf.length >= 10) {
          const elapsed = buf[buf.length - 1]!.time - buf[0]!.time;
          if (elapsed < 100) {
            const barcode = buf.map(b => b.char).join('');
            barcodeBuffer.current = [];
            e.preventDefault();
            dispatchScan(barcode);
            return;
          }
        }
        barcodeBuffer.current = [];
        return;
      }
      if (e.key.length === 1) {
        const now = Date.now();
        barcodeBuffer.current.push({ char: e.key, time: now });
        const cutoff = now - 200;
        barcodeBuffer.current = barcodeBuffer.current.filter(b => b.time >= cutoff);
      } else {
        barcodeBuffer.current = [];
      }
    };

    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('focusin', onFocusIn, { passive: true });
    document.addEventListener('focusout', onFocusOut, { passive: true });
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKeyDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, virtualKeyboardEnabled, scrollInputIntoView, releaseView, suppressOsKeyboard, releaseOsKeyboard]);

  const value = useMemo<GlobalInputContextValue>(() => ({
    keyboardVisible,
    isListening: speech.isListening,
    isInputFocused,
    isMobile,
    activeInputRef,
    activeContentEditableRef,
    setKeyboardVisible,
    setIsListening: () => {},
    injectText,
    startListening: speech.start,
    stopListening: speech.stop,
    virtualKeyboardEnabled,
  }), [
    keyboardVisible, speech.isListening, speech.start, speech.stop,
    isInputFocused, isMobile, setKeyboardVisible, injectText, virtualKeyboardEnabled,
  ]);

  return (
    <GlobalInputContext.Provider value={value}>
      {children}
    </GlobalInputContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGlobalInput(): GlobalInputContextValue {
  const ctx = useContext(GlobalInputContext);
  if (!ctx) throw new Error('useGlobalInput must be used inside GlobalInputProvider');
  return ctx;
}
