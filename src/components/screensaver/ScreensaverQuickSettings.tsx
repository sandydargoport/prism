'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { EFFECT_ORDER, getEffect } from './effects';
import { useScreensaverMotion, type ScreensaverMotion } from './useScreensaverMotion';

/**
 * The screensaver's own settings, reachable from the screensaver.
 *
 * These live in Settings → Appearance → Screensaver, which is the right place
 * for them and the wrong place to be standing when you want to try something:
 * every adjustment meant leaving the screensaver, finding the page, changing
 * one value and waiting for the screensaver to come back. Tuning something you
 * can only judge by looking at it needs to happen in front of it.
 *
 * Only per-display preferences are here — which effect, how often, how many
 * widgets, outlines. Nothing that touches family data, so nothing that needs a
 * PIN. The timers stay in Settings, where a considered decision belongs.
 *
 * Everything inside is marked data-screensaver-keep, which is how the idle
 * watcher knows a tap in here is somebody using the display rather than
 * somebody dismissing it.
 */
export function ScreensaverQuickSettings() {
  const [open, setOpen] = useState(false);
  const {
    motion, setMotion,
    interval, setInterval,
    floor, setFloor,
    ceiling, setCeiling,
    outlines, setOutlines,
    shortcut,
  } = useScreensaverMotion();

  // Escape closes it, as it does everywhere else in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!shortcut) return null;

  const select = 'border border-white/25 rounded px-2 py-1 text-sm bg-black/50 text-white';

  return (
    <div data-screensaver-keep className="absolute inset-0 z-10 pointer-events-none">
      {/* Faint at rest: it is a way back in, not part of the picture.

          The resting opacity is a compromise rather than a default. A wall
          display has no hover, so whatever this looks like at rest is what it
          looks like — faint enough to stay out of the picture, solid enough to
          be findable by somebody who knows it is there. */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Screensaver settings"
        className="pointer-events-auto absolute left-5 top-5 h-12 w-12 rounded-full
                   bg-black/35 backdrop-blur-sm border border-white/20
                   opacity-60 hover:opacity-100 focus-visible:opacity-100
                   transition-opacity duration-500
                   flex items-center justify-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-prism.png"
          alt=""
          className="h-7 w-7 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
        />
      </button>

      {open && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/45">
          <div className="w-[min(30rem,92vw)] rounded-2xl border border-white/15 bg-neutral-900/95 p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Screensaver</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm text-white/70">Transition effect</span>
                <select
                  value={motion}
                  onChange={(e) => setMotion(e.target.value as ScreensaverMotion)}
                  className={select}
                >
                  <option value="off">None</option>
                  {EFFECT_ORDER.map((id) => (
                    <option key={id} value={id}>{getEffect(id)?.label ?? id}</option>
                  ))}
                </select>
              </label>

              {motion !== 'off' && (
                <>
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/70">Change every</span>
                    <select
                      value={interval}
                      onChange={(e) => setInterval(Number(e.target.value))}
                      className={select}
                    >
                      <option value={10}>10 seconds</option>
                      <option value={20}>20 seconds</option>
                      <option value={45}>45 seconds</option>
                      <option value={90}>1.5 minutes</option>
                      <option value={300}>5 minutes</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/70">Show at least</span>
                    <select
                      value={floor}
                      onChange={(e) => setFloor(Number(e.target.value))}
                      className={select}
                    >
                      {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                        <option key={n} value={n}>{n} widget{n === 1 ? '' : 's'}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/70">and at most</span>
                    <select
                      value={ceiling}
                      onChange={(e) => setCeiling(Number(e.target.value))}
                      className={select}
                    >
                      <option value={0}>no limit</option>
                      {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                        <option key={n} value={n}>{n} widgets</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <span className="text-sm text-white/70">Hide widget outlines</span>
                    <input
                      type="checkbox"
                      checked={!outlines}
                      onChange={(e) => setOutlines(!e.target.checked)}
                      className="h-4 w-4 rounded border-white/30"
                    />
                  </label>
                </>
              )}
            </div>

            <p className="mt-4 text-xs text-white/40">
              These apply to this display only. Timers and photos are in
              Settings → Appearance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
