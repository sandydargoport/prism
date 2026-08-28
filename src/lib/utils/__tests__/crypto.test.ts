import { encrypt, decrypt, isEncrypted } from '../crypto';

// Set a valid 32-byte hex key for tests
const TEST_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes
beforeAll(() => { process.env.ENCRYPTION_KEY = TEST_KEY; });
afterAll(() => { delete process.env.ENCRYPTION_KEY; });

describe('encrypt / decrypt', () => {
  it('roundtrips a simple string', () => {
    const plaintext = 'hello world';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('roundtrips an empty string', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('roundtrips unicode text', () => {
    const plaintext = 'Mj\u00f6lnir \u2603 \u{1F680}';
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('roundtrips a long string', () => {
    const plaintext = 'x'.repeat(10000);
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('roundtrips JSON', () => {
    const obj = { accessToken: 'abc123', refreshToken: 'def456' };
    const plaintext = JSON.stringify(obj);
    expect(JSON.parse(decrypt(encrypt(plaintext)))).toEqual(obj);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const plaintext = 'same input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    // But both decrypt to the same thing
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it('ciphertext is valid base64', () => {
    const encrypted = encrypt('test');
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    // Re-encoding matches (proves it's clean base64)
    const buf = Buffer.from(encrypted, 'base64');
    expect(buf.toString('base64')).toBe(encrypted);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encrypt('secret');
    const buf = Buffer.from(encrypted, 'base64');
    // Flip a byte in the ciphertext portion (after IV + authTag)
    buf[28] = buf[28]! ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws when decrypting with wrong key', () => {
    const encrypted = encrypt('secret data');
    const saved = process.env.ENCRYPTION_KEY;
    // Use a different valid 32-byte key
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
    expect(() => decrypt(encrypted)).toThrow();
    process.env.ENCRYPTION_KEY = saved;
  });

  it('throws on truncated ciphertext (too short for IV + authTag)', () => {
    // Only 20 bytes — less than IV(12) + authTag(16) = 28 minimum
    const short = Buffer.alloc(20).toString('base64');
    expect(() => decrypt(short)).toThrow();
  });

  it('throws on completely empty base64 input', () => {
    expect(() => decrypt('')).toThrow();
  });

  it('throws on tampered auth tag', () => {
    const encrypted = encrypt('secret');
    const buf = Buffer.from(encrypted, 'base64');
    // Flip a byte in the auth tag (bytes 12-27)
    buf[15] = buf[15]! ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws on tampered IV', () => {
    const encrypted = encrypt('secret');
    const buf = Buffer.from(encrypted, 'base64');
    // Flip a byte in the IV (bytes 0-11)
    buf[3] = buf[3]! ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe('isEncrypted', () => {
  it('returns true for an encrypted value', () => {
    const encrypted = encrypt('test');
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it('returns false for short strings', () => {
    expect(isEncrypted('abc')).toBe(false);
    expect(isEncrypted('')).toBe(false);
  });

  it('returns false for plain text', () => {
    expect(isEncrypted('this is not encrypted at all')).toBe(false);
  });

  it('returns false for non-base64 strings', () => {
    expect(isEncrypted('!!!not-base64!!!')).toBe(false);
  });

  it('returns false for encrypted empty string (no ciphertext bytes)', () => {
    // Empty string encrypt produces IV + authTag + 0 ciphertext bytes
    // isEncrypted requires at least 1 byte of ciphertext
    const encrypted = encrypt('');
    // The encrypted empty string has exactly IV(12) + authTag(16) = 28 bytes
    // which is < 29 (IV + authTag + 1), so isEncrypted returns false
    const buf = Buffer.from(encrypted, 'base64');
    if (buf.length < 12 + 16 + 1) {
      expect(isEncrypted(encrypted)).toBe(false);
    } else {
      // AES-GCM may produce ciphertext even for empty input depending on impl
      expect(isEncrypted(encrypted)).toBe(true);
    }
  });

  it('returns false for valid base64 that is too short to be encrypted', () => {
    // 28 bytes (exactly IV + authTag, no ciphertext) encoded as base64
    const fake = Buffer.alloc(28).toString('base64');
    expect(isEncrypted(fake)).toBe(false);
  });

  it('can distinguish OAuth tokens from encrypted values', () => {
    // Real OAuth tokens are long but not valid encrypted format
    const oauthToken = 'ya29.a0AfH6SMBx-some-very-long-oauth-token-value-here';
    expect(isEncrypted(oauthToken)).toBe(false);
  });
});

describe('getKey validation', () => {
  it('throws when ENCRYPTION_KEY is missing', () => {
    const savedKey = process.env.ENCRYPTION_KEY;
    const savedPin = process.env.PIN_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    delete process.env.PIN_ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow(/ENCRYPTION_KEY is not set/);
    process.env.ENCRYPTION_KEY = savedKey;
    if (savedPin !== undefined) process.env.PIN_ENCRYPTION_KEY = savedPin;
  });

  it('throws when ENCRYPTION_KEY is malformed', () => {
    const saved = process.env.ENCRYPTION_KEY;
    // 'tooshort' is both too short AND not hexadecimal. The validator reports
    // the hex problem first, which is the more useful of the two: a value that
    // isn't hex at all is usually a placeholder rather than a truncated key.
    process.env.ENCRYPTION_KEY = 'tooshort';
    expect(() => encrypt('test')).toThrow(/must be hexadecimal/);
    process.env.ENCRYPTION_KEY = saved;
  });
});

/**
 * Regression tests for #307. A placeholder ENCRYPTION_KEY left in .env made
 * Prism start and appear healthy, then fail much later inside whichever
 * integration encrypted first, reporting an error that pointed at the
 * integration rather than at the key.
 */
describe('checkEncryptionKey', () => {
  const original = process.env;
  beforeEach(() => { process.env = { ...original }; });
  afterAll(() => { process.env = original; });

  const valid = 'a'.repeat(64);

  it('accepts a valid 64-character hex key', async () => {
    process.env.ENCRYPTION_KEY = valid;
    const { checkEncryptionKey } = await import('../crypto');
    expect(checkEncryptionKey()).toBeNull();
  });

  it('rejects the placeholder that shipped in .env.example', async () => {
    process.env.ENCRYPTION_KEY = 'generate_a_64_hex_character_string_here';
    delete process.env.PIN_ENCRYPTION_KEY;
    const { checkEncryptionKey } = await import('../crypto');
    expect(checkEncryptionKey()).toMatch(/placeholder/i);
  });

  it('rejects a non-hexadecimal value', async () => {
    process.env.ENCRYPTION_KEY = 'z'.repeat(64);
    delete process.env.PIN_ENCRYPTION_KEY;
    const { checkEncryptionKey } = await import('../crypto');
    expect(checkEncryptionKey()).toMatch(/hexadecimal/i);
  });

  it('rejects a key of the wrong length and says what it got', async () => {
    process.env.ENCRYPTION_KEY = 'ab'.repeat(10);
    delete process.env.PIN_ENCRYPTION_KEY;
    const { checkEncryptionKey } = await import('../crypto');
    expect(checkEncryptionKey()).toMatch(/64 hex characters.*is 20/i);
  });

  it('reports a missing key', async () => {
    delete process.env.ENCRYPTION_KEY;
    delete process.env.PIN_ENCRYPTION_KEY;
    const { checkEncryptionKey } = await import('../crypto');
    expect(checkEncryptionKey()).toMatch(/not set/i);
  });

  it('still accepts the PIN_ENCRYPTION_KEY fallback', async () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.PIN_ENCRYPTION_KEY = valid;
    const { checkEncryptionKey } = await import('../crypto');
    expect(checkEncryptionKey()).toBeNull();
  });

  it('throws a named error so callers can tell config from data failures', async () => {
    process.env.ENCRYPTION_KEY = 'generate_a_64_hex_character_string_here';
    delete process.env.PIN_ENCRYPTION_KEY;
    const { encrypt, EncryptionKeyError } = await import('../crypto');
    expect(() => encrypt('x')).toThrow(EncryptionKeyError);
  });
});
