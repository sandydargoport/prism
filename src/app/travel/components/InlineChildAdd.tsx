'use client';

import { useState, useCallback, useRef } from 'react';
import { Emoji } from '@/components/ui/Emoji';
import { Search, Loader2, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { GeocodeResult } from '../types';
import { NPS_UNITS } from '../constants/nationalParks';

type ChildType = 'stop' | 'national_park';

interface InlineChildAddProps {
  childType: ChildType;
  onAdd: (name: string, lat: number, lng: number, placeName: string | null) => Promise<void>;
}

export function InlineChildAdd({ childType, onAdd }: InlineChildAddProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parkResults = childType === 'national_park'
    ? NPS_UNITS.filter((u) => u.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : [];

  const searchGeocode = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/travel/geocode?q=${encodeURIComponent(q)}`);
      if (r.ok) {
        const data = await r.json();
        setResults((data.results ?? []) as GeocodeResult[]);
      }
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (childType === 'stop') {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => searchGeocode(val), 400);
    }
  };

  const handleSelectStop = async (r: GeocodeResult) => {
    setAdding(true);
    try {
      await onAdd(r.displayName, r.latitude, r.longitude, r.fullName ?? null);
      close();
    } finally {
      setAdding(false);
    }
  };

  const handleSelectPark = async (name: string) => {
    setAdding(true);
    // Optimistically call with 0,0 and geocode in the background
    const promise = onAdd(name, 0, 0, null);
    // Fire geocode to get real coords — caller will handle updating if needed
    fetch(`/api/travel/geocode?q=${encodeURIComponent(name + ' National Park')}`)
      .then((r) => r.json())
      .then((data) => {
        const first = (data.results as GeocodeResult[])?.[0];
        if (first) {
          // Best-effort: the caller should save coords when geocode resolves
          // We pass them via a follow-up; for now the pin is created with 0,0
          // and the TravelView parent must handle the update.
          // This is acceptable — user can see the park is added and move on.
        }
      })
      .catch(() => {});
    try {
      await promise;
      close();
    } finally {
      setAdding(false);
    }
  };

  const handleSelectParkWithGeocode = async (name: string) => {
    setAdding(true);
    try {
      // Geocode first so the pin lands on the map right away
      let lat = 0, lng = 0, placeName: string | null = null;
      try {
        const r = await fetch(`/api/travel/geocode?q=${encodeURIComponent(name + ' National Park')}`);
        const data = await r.json();
        const first = (data.results as GeocodeResult[])?.[0];
        if (first) { lat = first.latitude; lng = first.longitude; placeName = first.fullName ?? null; }
      } catch { /* keep 0,0 */ }
      await onAdd(name, lat, lng, placeName);
      close();
    } finally {
      setAdding(false);
    }
  };

  const close = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-0.5 text-xs text-primary hover:underline font-medium"
      >
        <Plus className="h-3 w-3" />
        {childType === 'national_park' ? 'Add park' : 'Add stop'}
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-1">
      <div className="relative">
        <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          autoFocus
          placeholder={childType === 'national_park' ? 'Search national parks…' : 'Search city or place…'}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="pl-7 pr-7 h-7 text-xs"
          disabled={adding}
        />
        {searching || adding ? (
          <Loader2 className="absolute right-2 top-1.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <button onClick={close} className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Stop geocode results */}
      {childType === 'stop' && results.length > 0 && (
        <div className="rounded-md border border-border bg-popover shadow-md max-h-44 overflow-y-auto">
          {results.map((r) => (
            <button key={r.placeId}
              disabled={adding}
              onClick={() => handleSelectStop(r)}
              className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent transition-colors border-b border-border last:border-0"
            >
              <div className="font-medium truncate">{r.displayName}</div>
              {r.fullName && r.fullName !== r.displayName && (
                <div className="text-muted-foreground truncate text-[10px]">{r.fullName}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Park NPS picker */}
      {childType === 'national_park' && (
        <div className={cn('rounded-md border border-border bg-popover shadow-md max-h-44 overflow-y-auto', !query && 'hidden')}>
          {parkResults.length > 0 ? parkResults.map((u) => (
            <button key={u.name}
              disabled={adding}
              onClick={() => handleSelectParkWithGeocode(u.name)}
              className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent transition-colors border-b border-border last:border-0 flex items-center gap-1.5"
            >
              <Emoji e="🌲" /> <span className="font-medium">{u.name}</span>
              <span className="text-muted-foreground text-[10px] ml-auto">{u.type}</span>
            </button>
          )) : (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">No matches</p>
          )}
        </div>
      )}
    </div>
  );
}
