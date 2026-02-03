import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  // Accept hex-encoded 32-byte key
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return buf;
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
