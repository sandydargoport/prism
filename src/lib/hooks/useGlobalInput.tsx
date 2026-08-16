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
  return !!el.closest('[data-virtual-keyboard]');
}

function getScrollParent(el: Element): Element | Window {
  let parent = el.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    if (['auto', 'scroll'].includes(style.overflowY)) return parent;
    parent = parent.parentElement;
  }
  return window;
}

function isRealKeyboardEvent(e: KeyboardEvent): boolean {
  if (!e.isTrusted) return false;
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const KEYBOARD_HEIGHT_VH = 32;
const SCROLL_MARGIN_PX = 16;

export function GlobalInputProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [keyboardVisible, setKeyboardVisibleState] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const activeContentEditableRef = useRef<HTMLElement | null>(null);
  const originalScrollY = useRef<number | null>(null);
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

  // ---- scroll helpers ----
  const scrollInputIntoView = useCallback((el: Element) => {
    const rect = el.getBoundingClientRect();
    const keyboardTop = window.innerHeight * (1 - KEYBOARD_HEIGHT_VH / 100);
    if (rect.bottom + SCROLL_MARGIN_PX > keyboardTop) {
      originalScrollY.current = window.scrollY;
      const scrollNeeded = rect.bottom + SCROLL_MARGIN_PX - keyboardTop;
      const scrollParent = getScrollParent(el);
      if (scrollParent === window) {
        window.scrollBy({ top: scrollNeeded, behavior: 'smooth' });
      } else {
        (scrollParent as Element).scrollBy({ top: scrollNeeded, behavior: 'smooth' });
      }
    }
  }, []);

  const restoreScroll = useCallback(() => {
    if (originalScrollY.current !== null) {
      window.scrollTo({ top: originalScrollY.current, behavior: 'smooth' });
      originalScrollY.current = null;
    }
  }, []);

  // ---- setKeyboardVisible (public) ----
  const setKeyboardVisible = useCallback((visible: boolean) => {
    setKeyboardVisibleState(visible);
    if (visible) {
      textInjectedWhileOpen.current = false;
    } else {
      // Explicit close (↓ dismiss / Enter). Clear the keyboard-tap flag so the
      // blur those keys trigger isn't caught by the focusout refocus guard,
      // which would otherwise immediately reopen the keyboard.
      pointerOnKeyboardRef.current = false;
      if (!textInjectedWhileOpen.current) restoreScroll();
      textInjectedWhileOpen.current = false;
    }
  }, [restoreScroll]);

  // ---- keyboard height CSS var ----
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--keyboard-height',
      keyboardVisible ? `${KEYBOARD_HEIGHT_VH}vh` : '0px',
    );
  }, [keyboardVisible]);

  // ---- barcode buffer ----
  const barcodeBuffer = useRef<{ char: string; time: number }[]>([]);

  // ---- document event listeners ----
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        lastPointerTypeRef.current = 'touch';
      } else if (e.pointerType === 'mouse') {
        lastPointerTypeRef.current = 'mouse';
      }
      const t = e.target;
      pointerOnKeyboardRef.current = t instanceof Element && isInsideKeyboard(t);
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element;
      if (!shouldShowKeyboard(target)) {
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
      if (
        lastPointerTypeRef.current === 'touch' &&
        !isMobile &&
        !suppressedForScan.current &&
        virtualKeyboardEnabled
      ) {
        const wasVisible = keyboardVisibleRef.current;
        setKeyboardVisibleState(true);
        // Don't re-scroll when this focusin is the restore-focus that follows a
        // keyboard key tap — the keyboard is already open and in place.
        if (!wasVisible) scrollInputIntoView(target);
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Element | null;
      if (next && isInsideKeyboard(next)) return;
      // Tapping a virtual-keyboard key blurs the input (its keys are
      // non-focusable divs, so relatedTarget is null). Restore focus to the
      // active field and keep the keyboard open, rather than tearing it down —
      // this is the touch-safe fix for the recurring first-tap-dismiss bug that
      // preventDefault (swallowed by simple-keyboard) never reliably solved.
      if (pointerOnKeyboardRef.current) {
        const el = activeContentEditableRef.current ?? activeInputRef.current;
        if (el) { el.focus({ preventScroll: true }); return; }
      }
      activeInputRef.current = null;
      activeContentEditableRef.current = null;
      setIsInputFocused(false);
      setKeyboardVisibleState(false);
      if (!textInjectedWhileOpen.current) restoreScroll();
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
  }, [isMobile, virtualKeyboardEnabled, scrollInputIntoView, restoreScroll]);

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
