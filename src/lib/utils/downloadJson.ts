/**
 * Save a value as a pretty-printed .json file through the browser's download.
 *
 * The object URL is revoked on the next tick rather than at once: some browsers
 * start the download asynchronously, and revoking first cancels it.
 */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A name reduced to lowercase letters, digits and single hyphens. */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Copy a value as pretty-printed JSON, or save it as a file when the page
 * cannot copy (#1147). Over a plain http:// address the browser gives no
 * clipboard at all, and the copy used to throw before saying anything.
 */
export async function copyOrDownloadJson(filename: string, data: unknown): Promise<'copied' | 'downloaded'> {
  const text = JSON.stringify(data, null, 2);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    // Denied or failed: fall through to the file.
  }
  downloadJson(filename, data);
  return 'downloaded';
}
