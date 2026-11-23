/**
 * envCredential.ts
 *
 * Reads an OAuth credential from the environment, treating a blank value or
 * one of the placeholders that `.env.example` ships as "not set".
 *
 * `.env.example` has the Google and Microsoft client id and secret lines
 * uncommented, filled with placeholder text. A `.env` copied from it and never
 * edited still has them, and a plain truthiness check counts them as
 * configured: the Connect button then sends the browser to the provider with
 * a client id that cannot work, and the provider shows its own error page
 * instead of Prism showing its setup prompt.
 *
 * Every place that reads one of these variables goes through `envCredential`
 * so the "is it configured" check, the connect routes and token refresh all
 * agree. Only the exact placeholder strings match, so a real credential never
 * can. A test keeps this list in step with `.env.example`.
 */

export const ENV_EXAMPLE_PLACEHOLDERS: Readonly<Record<string, string>> = {
  GOOGLE_CLIENT_ID: 'your-google-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'your-google-client-secret',
  MICROSOFT_CLIENT_ID: 'your-microsoft-client-id',
  MICROSOFT_CLIENT_SECRET: 'your-microsoft-client-secret',
};

const PLACEHOLDER_VALUES = new Set(Object.values(ENV_EXAMPLE_PLACEHOLDERS));

/**
 * The environment variable's value, or `undefined` when it is missing, blank,
 * or still the placeholder from `.env.example`.
 */
export function envCredential(name: string): string | undefined {
  const value = process.env[name];
  const trimmed = value?.trim();
  if (!trimmed || PLACEHOLDER_VALUES.has(trimmed)) return undefined;
  return value;
}
