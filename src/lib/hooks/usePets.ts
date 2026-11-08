'use client';

import { useCallback, useState } from 'react';
import { useFetchOnMount } from './useFetchOnMount';

/** A pet (#996): a name, a kind and a colour; a chore can be for one. */
export type Pet = { id: string; name: string; kind: 'cat' | 'dog' | 'other'; color: string };

export const PET_KINDS: ReadonlyArray<{ value: Pet['kind']; label: string; emoji: string }> = [
  { value: 'cat', label: 'Cat', emoji: '🐈' },
  { value: 'dog', label: 'Dog', emoji: '🐕' },
  { value: 'other', label: 'Other', emoji: '🐾' },
];

/** The household's pets, and a refresh for after a change. */
export function usePets(): { pets: Pet[]; refresh: () => Promise<void> } {
  const [pets, setPets] = useState<Pet[]>([]);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/pets', { signal });
      if (!res.ok) return;
      const data = (await res.json()) as { pets?: Pet[] };
      if (!signal?.aborted) setPets(data.pets ?? []);
    } catch {
      // Aborted or offline: keep what we have.
    }
  }, []);
  useFetchOnMount(load);
  return { pets, refresh: useCallback(() => load(), [load]) };
}
