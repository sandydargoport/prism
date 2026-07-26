/**
 * Scale the amount in a single ingredient line by a factor.
 *
 * Prism stores one ingredient per line, so ONLY the leading quantity is the
 * amount to scale. Any later number is a size / pack / temperature descriptor
 * that must be left untouched — e.g. "1 8 oz can" doubled is "2 8 oz can"
 * (two 8-oz cans), NOT "2 16 oz can"; "1 9x13 pan" stays "1 9x13 pan".
 *
 * The leading quantity may be a mixed number ("1 1/2"), a fraction ("3/4"), or
 * a decimal / integer ("2", "1.5"). Everything after it is preserved verbatim.
 */

const COMMON_FRACTIONS: Array<[number, string]> = [
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [1 / 2, '1/2'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
];

/** Render a scaled amount readably: whole, common fraction, or mixed number. */
export function formatQuantity(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;

  // Near a whole number.
  if (frac < 0.02) return String(whole);
  if (frac > 0.98) return String(whole + 1);

  for (const [value, label] of COMMON_FRACTIONS) {
    if (Math.abs(frac - value) < 0.02) return whole > 0 ? `${whole} ${label}` : label;
  }
  // Fallback: trimmed decimal.
  return String(Math.round(n * 100) / 100);
}

// Leading quantity: mixed number | fraction | decimal/integer (first alt wins).
const LEADING_QTY = /(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|\d+(?:\.\d+)?/;

export function scaleIngredientText(text: string, factor: number): string {
  if (!Number.isFinite(factor) || factor === 1) return text;
  const m = LEADING_QTY.exec(text);
  if (!m) return text;

  let value: number;
  if (m[1] !== undefined) {
    // mixed number "W N/D"
    value = Number(m[1]) + Number(m[2]) / Number(m[3]);
  } else if (m[4] !== undefined) {
    // fraction "N/D"
    value = Number(m[4]) / Number(m[5]);
  } else {
    value = parseFloat(m[0]);
  }

  const scaled = value * factor;
  return text.slice(0, m.index) + formatQuantity(scaled) + text.slice(m.index + m[0].length);
}
