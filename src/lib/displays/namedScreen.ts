'use client';

import { remoteEditHost } from './remoteEdit';

/**
 * Is this browser a screen named in Settings > Screens (#690)?
 *
 * Reads the readable marker the server sets when a screen is named; it carries
 * no id and grants nothing. The frame of a phone editing a screen shares the
 * phone's cookies, but it is not the phone's screen, so it never counts (#1153).
 */
export function isNamedScreen(): boolean {
  if (typeof document === 'undefined') return false;
  if (remoteEditHost()) return false;
  return document.cookie.split('; ').includes('prism_display_named=1');
}
