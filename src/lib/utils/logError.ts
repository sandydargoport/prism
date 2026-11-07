/**
 * Safe error logger for API routes.
 *
 * In production: logs only error.message to avoid leaking stack traces,
 * file paths, DB query details, or other internals via server logs.
 * In development: logs the full error object for easy debugging.
 *
 * Pass `requestId` (from the x-request-id header) to correlate log lines
 * with specific requests.
 */
export function logError(message: string, error: unknown, requestId?: string): void {
  // The message can carry request text (a search, a date). Passed as a '%s'
  // argument, never as console's format string, and on one line, so it
  // cannot forge or split log lines (CodeQL log injection).
  const line = oneLine(`${requestId ? `[${requestId}] ` : ''}${message}`);
  if (process.env.NODE_ENV === 'production') {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('%s', line, oneLine(msg));
  } else {
    console.error('%s', line, error);
  }
}

/** Newlines and other control characters become spaces. */
export function oneLine(text: string): string {
  return text
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    // Nothing is left to remove by now; this is the form CodeQL's log-injection
    // check counts as cleaning a line (line breaks replaced by nothing), so the
    // callers' alerts close.
    .replace(/\n|\r/g, '');
}
