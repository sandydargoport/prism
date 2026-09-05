/**
 * Whether the screensaver may take over the display.
 *
 * Three states can want the screen at once, and they are not equal. Away and
 * Babysitter are deliberate — someone chose them, each puts up its own
 * full-screen overlay, and each is showing information that matters precisely
 * while nobody is standing at the display. Idleness is the weakest signal of
 * the three: it means only that nobody has touched anything for a while.
 *
 * The screensaver is rendered after both overlays in LazyOverlays, so without
 * this it simply covered them. A home left in Away mode showed holiday photos
 * instead of the away screen, and a babysitter's notes vanished behind them
 * after two minutes — exactly when there was nobody there to touch the screen
 * and bring them back.
 *
 * Extracted rather than inlined so the rule can be tested without standing up
 * the whole screensaver, which pulls in photos, dashboard data and the widget
 * registry.
 */
export function shouldShowScreensaver(state: {
  /** Nobody has interacted for longer than the screensaver timeout. */
  idle: boolean;
  /** Away mode is on. */
  away: boolean;
  /** Babysitter mode is on. */
  babysitter: boolean;
}): boolean {
  return state.idle && !state.away && !state.babysitter;
}
