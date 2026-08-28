import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Raised when the encryption key itself is unusable, as opposed to anything
 * going wrong with the data being encrypted.
 *
 * It exists so callers can tell the two apart. Handlers deliberately log only
 * `err.name` to keep credentials out of the logs, which meant a misconfigured
 * key surfaced as a bare "Error" and read as a problem with whatever the user
 * was doing at the time. A distinct name is safe to log and safe to show:
 * nothing here contains a secret. See #307.
 */
export class EncryptionKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionKeyError';
  }
}

/** Guidance appended to every key error, since the fix is always the same. */
const HOW_TO_GENERATE =
  'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';

/**
 * Validate the configured key without encrypting anything.
 *
 * Returns null when usable, or a human-readable reason when not. Used at
 * startup so a bad key is reported once, loudly, instead of surfacing later as
 * an unrelated-looking failure in whichever integration happens to encrypt
 * first.
 */
export function checkEncryptionKey(): string | null {
  const key = process.env.ENCRYPTION_KEY || process.env.PIN_ENCRYPTION_KEY;
  if (!key) {
    return `ENCRYPTION_KEY is not set (PIN_ENCRYPTION_KEY is accepted as a fallback). ${HOW_TO_GENERATE}`;
  }
  // A placeholder copied from .env.example is the common case: it looks
  // configured, so nothing about the running app suggests otherwise.
  if (/^generate_/i.test(key)) {
    return `ENCRYPTION_KEY is still the example placeholder from .env.example. ${HOW_TO_GENERATE}`;
  }
  if (!/^[0-9a-fA-F]+$/.test(key)) {
    return `ENCRYPTION_KEY must be hexadecimal, and this value contains other characters. ${HOW_TO_GENERATE}`;
  }
  if (key.length !== 64) {
    return `ENCRYPTION_KEY must be 64 hex characters (32 bytes); this one is ${key.length}. ${HOW_TO_GENERATE}`;
  }
  return null;
}

function getKey(): Buffer {
  // Backward compatibility:
  // Older installs generated PIN_ENCRYPTION_KEY but not ENCRYPTION_KEY.
  // Prefer ENCRYPTION_KEY for integrations, fall back to PIN_ENCRYPTION_KEY.
  const problem = checkEncryptionKey();
  if (problem) throw new EncryptionKeyError(problem);
  const key = (process.env.ENCRYPTION_KEY || process.env.PIN_ENCRYPTION_KEY)!;
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded string: iv + authTag + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack as: iv (12) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a value produced by encrypt().
 */
export function decrypt(encoded: string): string {
  const key = getKey();
  const data = Buffer.from(encoded, 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(ciphertext) + decipher.final('utf8');
}

/**
 * Check if a value looks like it's already encrypted (base64 with correct min length).
 * Used during migration to avoid double-encrypting.
 */
export function isEncrypted(value: string): boolean {
  // Minimum length: base64 of IV(12) + authTag(16) + at least 1 byte ciphertext
  if (value.length < 40) return false;
  try {
    const buf = Buffer.from(value, 'base64');
    // Re-encode and check roundtrip to confirm it's valid base64
    return buf.toString('base64') === value && buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}
