'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface LocationCandidate {
  displayName: string;
  lat: number;
  lon: number;
}

const NO_CANDIDATES: LocationCandidate[] = [];

interface StoredLocation {
  lat?: number;
  lon?: number;
  displayName?: string;
  // legacy fields kept for reading existing installs
  zipCode?: string;
  city?: string;
  state?: string;
}

function legacyDisplayName(loc: StoredLocation): string {
  if (loc.zipCode) return loc.zipCode;
  return [loc.city, loc.state].filter(Boolean).join(', ');
}

/**
 * Debounced city/postal-code search against the keyless /api/location-search
 * endpoint, plus persisting the chosen candidate to `settings.location`.
 * Shared by the Settings > General location card and the setup wizard's
 * household step so both use the exact same search + save behavior.
 */
export function useLocationSearch() {
  const [query, setQuery] = useState('');
  const [savedName, setSavedName] = useState<string | null>(null);
  const [results, setResults] = useState<LocationCandidate[]>([]);
  // Whether the candidate dropdown is showing. Results arriving open it; a
  // click outside or a pick closes it.
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load current saved location on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const loc = data?.settings?.location as StoredLocation | undefined;
        if (loc?.displayName) setSavedName(loc.displayName);
        else if (loc) setSavedName(legacyDisplayName(loc) || null);
      })
      .catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) return;

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/location-search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        const found: LocationCandidate[] = data.results ?? [];
        setResults(found);
        setOpen(found.length > 0);
      } catch {
        /* ignore */
      }
      setSearching(false);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const select = useCallback(async (candidate: LocationCandidate) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setSavedName(candidate.displayName);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'location',
          value: { lat: candidate.lat, lon: candidate.lon, displayName: candidate.displayName },
        }),
      });
    } catch {
      /* ignore */
    }
    setSaving(false);
  }, []);

  const clear = useCallback(async () => {
    setSavedName(null);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'location', value: null }),
      });
    } catch {
      /* ignore */
    }
    setSaving(false);
  }, []);

  // A query too short to search lists nothing, whatever the last search found.
  const candidates = query.length < 2 ? NO_CANDIDATES : results;

  return { query, setQuery, savedName, candidates, searching, saving, select, clear, open, setOpen };
}
