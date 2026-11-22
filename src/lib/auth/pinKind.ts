/**
 * What a member signs in with (#1197): a numeric PIN, or a passcode of
 * lowercase letters and numbers. Both are an exact length, so the pad knows
 * when the last character is in and the dots show how far along it is.
 * Passcodes are lowercase so case is never a trap on a wall pad: anything
 * typed is lowercased before it is hashed or checked.
 */
import { MAX_PIN_LENGTH, MIN_PIN_LENGTH, PIN_LENGTH_OPTIONS } from '@/lib/constants';

export type PinKind = 'digits' | 'passcode';
export const PIN_KINDS: readonly PinKind[] = ['digits', 'passcode'];

export const PASSCODE_LENGTH_OPTIONS = [6, 8, 10, 12] as const;
const BOUNDS: Record<PinKind, [number, number]> = { digits: [MIN_PIN_LENGTH, MAX_PIN_LENGTH], passcode: [6, 12] };

export function isPinKind(v: unknown): v is PinKind {
  return v === 'digits' || v === 'passcode';
}

/** The lengths a member can choose for a kind. */
export function lengthOptions(kind: PinKind): readonly number[] {
  return kind === 'passcode' ? PASSCODE_LENGTH_OPTIONS : PIN_LENGTH_OPTIONS;
}

export function lengthAllowed(kind: PinKind, n: number): boolean {
  const [lo, hi] = BOUNDS[kind];
  return Number.isInteger(n) && n >= lo && n <= hi;
}

export function lengthBounds(kind: PinKind): [number, number] {
  return BOUNDS[kind];
}

/** What a field or a key may hold for this kind: digits, or lowercase letters and digits. */
export function normalizePin(kind: PinKind, raw: string): string {
  return kind === 'passcode' ? raw.toLowerCase().replace(/[^a-z0-9]/g, '') : raw.replace(/\D/g, '');
}

/** Whether `pin` is a complete credential of this kind and length. */
export function pinMatches(kind: PinKind, length: number, pin: string): boolean {
  return (kind === 'passcode' ? /^[a-z0-9]+$/ : /^\d+$/).test(pin) && pin.length === length;
}

/** "4 digits", "8 letters or numbers". */
export function describePin(kind: PinKind, length: number): string {
  return kind === 'passcode' ? `${length} letters or numbers` : `${length} digits`;
}

/** "PIN" or "passcode", for wording. */
export function pinNoun(kind: PinKind): string {
  return kind === 'passcode' ? 'passcode' : 'PIN';
}
