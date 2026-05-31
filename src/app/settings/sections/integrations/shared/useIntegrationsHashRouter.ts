'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Tracks which provider card sub-section is expanded based on the URL hash.
 *
 * Hash convention: `#<providerId>` or `#<providerId>-<subSectionId>`.
 * - `#microsoft` expands the Microsoft card (sub-sections collapsed).
 * - `#microsoft-onedrive` expands the Microsoft card AND its OneDrive sub-section.
 *
 * The hash is also the durable deep-link target — OAuth callbacks set
 * `?section=integrations#microsoft-onedrive` so the user lands back where
 * they started after authenticating.
 */
export function useIntegrationsHashRouter() {
  const [hash, setHash] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.location.hash.replace(/^#/, '');
  });

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash.replace(/^#/, ''));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setActive = useCallback((id: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.hash = id ? `#${id}` : '';
    window.history.replaceState({}, '', url.toString());
    setHash(id ?? '');
  }, []);

  const matches = useCallback(
    (id: string) => hash === id || hash.startsWith(`${id}-`),
    [hash],
  );

  return { hash, setActive, matches };
}
