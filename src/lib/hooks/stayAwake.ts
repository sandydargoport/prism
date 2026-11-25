/**
 * Whether a switch in force keeps the screen awake (#1347).
 *
 * The screen's schedule (useScreenSchedule) is the single writer: it turns
 * this on while a switch that stays awake is in force. The idle timer
 * (useIdleDetection) reads it: while it is on the screen does not go idle,
 * and when it comes on while the screen is idle the screen wakes, as a touch
 * would. When it goes off the idle countdown starts again from then.
 *
 * A module-level store, like useDisplayIdle and useEditing: the writer and
 * the reader sit in different parts of the tree.
 */
let awake = false;
const listeners = new Set<() => void>();

/** Keep the screen awake, or let it idle again. Called by useScreenSchedule. */
export function setStayAwake(next: boolean): void {
  if (next === awake) return;
  awake = next;
  for (const listener of listeners) listener();
}

/** Whether a switch is keeping the screen awake right now. */
export function isStayingAwake(): boolean {
  return awake;
}

export function subscribeStayAwake(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
