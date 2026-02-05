const MAGIC_BYTES: Record<string, { offset: number; bytes: number[] }[]> = {
  'image/jpeg': [{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }],
  'image/png': [{ offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  'image/webp': [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // WEBP
  ],
  'image/gif': [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }],
};

/**
 * Validates that a file buffer's magic bytes match the claimed MIME type.
 * Returns the detected MIME type if valid, or null if the bytes don't match
 * any allowed type.
 */
export function validateMagicBytes(
  buffer: Buffer,
  allowedTypes: readonly string[]
): string | null {
  for (const mimeType of allowedTypes) {
    const signatures = MAGIC_BYTES[mimeType];
    if (!signatures) continue;

    const matches = signatures.every(({ offset, bytes }) => {
      if (buffer.length < offset + bytes.length) return false;
      return bytes.every((b, i) => buffer[offset + i] === b);
    });

    if (matches) return mimeType;
  }

  return null;
}
