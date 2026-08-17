/**
 * True if `el` is (or just was) part of the on-screen virtual keyboard.
 *
 * Uses `closest('[data-virtual-keyboard]')` for attached nodes, then falls back
 * to simple-keyboard's own per-key markers (`data-skbtn` attribute / `hg-button`
 * class). The fallback matters because toggling Shift/symbols makes
 * simple-keyboard re-render and DETACH the tapped key: on the orphaned node
 * `closest()` returns null, so the dialog/focus dismissal guards would wrongly
 * treat the tap as "outside the keyboard" and close the dialog / hide the
 * keyboard. The marker checks read straight off the element and survive
 * detachment.
 */
export function isVirtualKeyboardTarget(el: Element | null | undefined): boolean {
  if (!el || typeof (el as Element).closest !== 'function') return false;
  const e = el as Element;
  if (e.closest('[data-virtual-keyboard]')) return true;
  if (typeof e.hasAttribute === 'function' && e.hasAttribute('data-skbtn')) return true;
  const cls = typeof e.className === 'string' ? e.className : '';
  if (cls.includes('hg-button') || cls.includes('simple-keyboard') || cls.includes('hg-theme')) return true;
  if (e.closest('.simple-keyboard')) return true;
  return false;
}
