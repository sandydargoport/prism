'use client';

/**
 * Widget magnify-on-double-tap (modal overlay variant).
 *
 * Double-tap any dashboard widget → it snaps to a centered ~84vw × 84vh
 * modal, with the rest of the dashboard dimmed behind. Auto-collapses
 * after AUTO_COLLAPSE_MS of inactivity (timer resets on any pointer /
 * wheel interaction inside the magnified widget), or immediately on
 * Escape / backdrop tap.
 *
 * Design notes:
 *  - No transition animation — the modal snaps in and out for minimum
 *    latency. (Earlier draft had a FLIP-style transition; user pulled
 *    it because the snap felt better.)
 *  - The widget is RE-RENDERED inside the overlay (not portal'd in
 *    place), so it runs as a fresh instance at the new gridW/gridH.
 *    Most widgets read from shared data hooks, so this is fine; ones
 *    with heavy local state would warrant moving to a portal approach.
 *  - Gated to the interactive Dashboard render path only. Screensaver,
 *    Away Mode, and Babysitter Mode never wrap their widgets in this
 *    provider, so the handler simply isn't attached there.
 */

import * as React from 'react';

const AUTO_COLLAPSE_MS = 8000;
// Centered target — small viewport margin so the dashboard chrome around
// the modal stays as a visual anchor ("this is temporarily bigger, not
// a new page").
const TARGET = { top: '8vh', left: '8vw', width: '84vw', height: '84vh' } as const;

interface ExpandContextValue {
  expandedId: string | null;
  triggerExpand: (id: string) => void;
  collapse: () => void;
}

const ExpandCtx = React.createContext<ExpandContextValue | null>(null);

export function useWidgetExpand(): ExpandContextValue {
  const ctx = React.useContext(ExpandCtx);
  // Outside the provider (screensaver / away / babysitter), return a
  // no-op shape so callers can unconditionally use the hook without
  // crashing those render paths.
  return ctx ?? { expandedId: null, triggerExpand: () => {}, collapse: () => {} };
}

interface ProviderProps {
  /** Renders the magnified widget body for the given widget id. */
  renderMagnified: (id: string) => React.ReactNode;
  children: React.ReactNode;
}

export function WidgetExpandProvider({ renderMagnified, children }: ProviderProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const scheduleCollapse = React.useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setExpandedId(null), AUTO_COLLAPSE_MS);
  }, [clearTimer]);

  const triggerExpand = React.useCallback((id: string) => {
    setExpandedId(id);
    scheduleCollapse();
  }, [scheduleCollapse]);

  const collapse = React.useCallback(() => {
    clearTimer();
    setExpandedId(null);
  }, [clearTimer]);

  // Escape key collapses.
  React.useEffect(() => {
    if (!expandedId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') collapse(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedId, collapse]);

  // Reset the auto-collapse timer on any interaction inside the modal.
  const handleInteraction = React.useCallback(() => {
    if (expandedId) scheduleCollapse();
  }, [expandedId, scheduleCollapse]);

  const value = React.useMemo<ExpandContextValue>(
    () => ({ expandedId, triggerExpand, collapse }),
    [expandedId, triggerExpand, collapse],
  );

  return (
    <ExpandCtx.Provider value={value}>
      {children}

      {expandedId && (
        <>
          <div
            data-keep-bg
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-xs"
            onClick={collapse}
            aria-hidden
          />
          <div
            data-keep-bg
            className="fixed z-50 overflow-hidden rounded-xl bg-card shadow-2xl ring-1 ring-border"
            style={TARGET}
            onPointerDownCapture={handleInteraction}
            onWheelCapture={handleInteraction}
            role="dialog"
            aria-modal="true"
          >
            {renderMagnified(expandedId)}
          </div>
        </>
      )}
    </ExpandCtx.Provider>
  );
}
