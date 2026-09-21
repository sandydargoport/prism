/**
 * Turning a failed fetch Response into something a person can act on.
 *
 * Call sites overwhelmingly do this:
 *
 *   if (!response.ok) {
 *     const data = await response.json();   // assumes JSON
 *     throw new Error(data.error);
 *   }
 *
 * which is right until the body is not JSON, and then it is worse than useless.
 * `.json()` on an HTML body throws `Unexpected token '<', "<!DOCTYPE "...`, and
 * that string replaces whatever the real failure was. The user sees a parser
 * complaint; the actual status never reaches them.
 *
 * It is not a rare case. Any of these returns HTML or an empty body:
 *
 *   - a 404 from a path the server does not route (Next.js renders a page)
 *   - a 502/504 from a proxy or tunnel in front of the app
 *   - a 405 on a method the route does not export
 *   - a stale service worker answering with a cached app shell
 *
 * The last one is how this surfaced: after a deploy changed every chunk hash, a
 * browser still running the previous build got HTML back from a request the new
 * server did not recognise, and the save dialog reported a JSON syntax error.
 *
 * So: look at what actually came back before trying to read it, and fall back to
 * the status, which is always meaningful.
 */

/** The shape API routes use for a rejection. Everything is optional by design. */
export interface ApiErrorBody {
  error?: string;
  message?: string;
  /** Zod-style issues; `path` names the field that was refused. */
  details?: Array<{ path?: (string | number)[] }>;
  [key: string]: unknown;
}

export interface ResponseError {
  /** Ready to show. Never empty, never a parser complaint. */
  message: string;
  /** Parsed body when the response actually carried JSON, else null. */
  body: ApiErrorBody | null;
  status: number;
}

/**
 * Describe a non-ok Response without assuming anything about its body.
 *
 * @param response the failed Response
 * @param fallback used when the body says nothing useful
 */
export async function readResponseError(
  response: Response,
  fallback = 'Something went wrong. Please try again.',
): Promise<ResponseError> {
  const status = response.status;
  const contentType = response.headers.get('content-type') || '';

  // Only attempt a parse when the server said it is JSON. Sniffing the body
  // instead would mean reading an HTML page in order to discover it is one.
  if (contentType.includes('application/json')) {
    try {
      const body = (await response.json()) as ApiErrorBody;
      const named = fieldNames(body);
      const base = body.error || body.message;

      if (base && named.length) return { message: `${base}: ${named.join(', ')}`, body, status };
      if (base) return { message: base, body, status };
      return { message: statusMessage(status, response.statusText, fallback), body, status };
    } catch {
      // Declared JSON, was not. Nothing to salvage, so describe the status.
      return { message: statusMessage(status, response.statusText, fallback), body: null, status };
    }
  }

  // Not JSON. Deliberately does NOT include the body: it is an HTML page, and
  // putting markup in front of someone is what this function exists to prevent.
  return { message: statusMessage(status, response.statusText, fallback), body: null, status };
}

/**
 * Which fields were refused, deduped and in order.
 *
 * A rejection that names the field is the difference between "Validation
 * failed", which gives someone nothing to do, and knowing which input to fix.
 */
function fieldNames(body: ApiErrorBody): string[] {
  if (!Array.isArray(body.details)) return [];
  const paths = body.details
    .map((issue) => issue?.path?.join('.'))
    .filter((p): p is string => !!p);
  return [...new Set(paths)];
}

/**
 * A status turned into a sentence.
 *
 * The common ones get wording that says what to do about it, because "404" on
 * a save dialog reads as broken software rather than as something recoverable.
 */
function statusMessage(status: number, statusText: string, fallback: string): string {
  switch (status) {
    case 401:
    case 403:
      return 'You are signed out. Sign in again and retry.';
    case 404:
      // The overwhelmingly likely cause in this app, and the one with a fix
      // the person can actually carry out.
      return 'The app could not reach that endpoint (404). This usually means the page is running an older version: reload, or use Settings, Backup, Clear Cache & Reload.';
    case 405:
      return 'That action is not allowed here (405). Reload the page and try again.';
    case 413:
      return 'That is too large to save.';
    case 429:
      return 'Too many requests just now. Wait a moment and try again.';
    case 502:
    case 503:
    case 504:
      return 'Prism did not respond in time. It may still be starting up; try again shortly.';
    default:
      if (status >= 500) return `The server failed on that request (${status}). Try again shortly.`;
      return statusText ? `${statusText} (${status})` : fallback;
  }
}
