/**
 * Where the last touch or click landed, for a sheet to open on that side of
 * the wall (#908). Recorded from app start: a dialog's own code is often
 * loaded by the very tap that opens it, too late to see that tap.
 */
let lastX: number | null = null;
let listening = false;

export function trackLastPointer(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('pointerdown', (e) => { lastX = e.clientX; }, { capture: true, passive: true });
}

export function lastPointerX(): number | null {
  return lastX;
}
