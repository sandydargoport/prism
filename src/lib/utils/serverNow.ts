/**
 * "Now" for what the server decides by the date: the household's today for
 * birthdays, and whether the bus is due.
 *
 * The screenshot run draws one fixed moment (PRISM_SEED_NOW for its seed and
 * browser). It sets PRISM_SCREENSHOT_NOW too, so these agree with the rest of
 * the picture. The variable is ignored unless E2E_HAS_TEST_DB=1, so a real
 * install always uses the real clock. Sessions and cookies never use this:
 * the browser checks their expiry against its own clock.
 */
export function serverNow(): Date {
  const fixed = process.env.PRISM_SCREENSHOT_NOW;
  if (fixed && process.env.E2E_HAS_TEST_DB === '1') {
    const at = new Date(fixed);
    if (!Number.isNaN(at.getTime())) return at;
  }
  return new Date();
}
