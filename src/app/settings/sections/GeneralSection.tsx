'use client';

/**
 * General settings — household / locale basics that aren't tied to one entity:
 * weather Location, Time zone, and Week-start. Previously scattered under
 * "Appearance" (Location) and "Calendars" (Time zone, Week starts on).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MapPin, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { useTimezone, detectBrowserTimezone } from '@/lib/hooks/useTimezone';
import { listTimezones } from '@/lib/utils/timezone';

export function GeneralSection() {
  return (
    <div className="space-y-6">
      <LocationCard />
      <TimezoneCard />
      <WeekStartCard />
    </div>
  );
}

interface LocationValue {
  lat?: number;
  lon?: number;
  displayName?: string;
  // legacy fields kept for reading existing installs
  zipCode?: string;
  city?: string;
  state?: string;
}

function legacyDisplayName(loc: LocationValue): string {
  if (loc.zipCode) return loc.zipCode;
  return [loc.city, loc.state].filter(Boolean).join(', ');
}

function LocationCard() {
  const [query, setQuery] = useState('');
  const [savedName, setSavedName] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<{ displayName: string; lat: number; lon: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load current saved location on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const loc = data?.settings?.location as LocationValue | undefined;
        if (loc?.displayName) setSavedName(loc.displayName);
        else if (loc) setSavedName(legacyDisplayName(loc) || null);
      })
      .catch(() => {});
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setCandidates([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/location-search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setCandidates(data.results ?? []);
        setOpen((data.results ?? []).length > 0);
      } catch { /* ignore */ }
      setSearching(false);
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const select = useCallback(async (candidate: { displayName: string; lat: number; lon: number }) => {
    setOpen(false);
    setQuery('');
    setSavedName(candidate.displayName);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'location', value: { lat: candidate.lat, lon: candidate.lon, displayName: candidate.displayName } }),
      });
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
    setSaving(false);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location</CardTitle>
        <CardDescription>
          Set your location for weather data. Search by city name or postal code — works worldwide.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {savedName && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 truncate">{savedName}</span>
            <button onClick={clear} disabled={saving} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div ref={wrapperRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            {searching
              ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
              : null}
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => candidates.length > 0 && setOpen(true)}
              placeholder={savedName ? 'Search to change location…' : 'Search city or postal code…'}
              className="pl-9"
              autoComplete="off"
            />
          </div>

          {open && candidates.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
              {candidates.map((c, i) => (
                <button
                  key={i}
                  onMouseDown={e => { e.preventDefault(); select(c); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {c.displayName}
                </button>
              ))}
            </div>
          )}
        </div>

        {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
      </CardContent>
    </Card>
  );
}

function TimezoneCard() {
  const { timezone, setTimezone, loading } = useTimezone();
  const zones = listTimezones();
  const detected = detectBrowserTimezone();
  // Make sure the current value is selectable even if it's outside the list.
  const options = zones.includes(timezone) ? zones : [timezone, ...zones];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time Zone</CardTitle>
        <CardDescription>
          Used for server-side scheduling and syncs — e.g. placing imported meal-plan times on the
          right day. On-screen clocks already follow each viewer&apos;s device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={timezone}
            disabled={loading}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-9 min-w-[16rem] rounded-md border border-border bg-background px-3 text-sm"
          >
            {options.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          {detected && detected !== timezone && (
            <Button variant="outline" size="sm" onClick={() => setTimezone(detected)}>
              Use detected ({detected.replace(/_/g, ' ')})
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekStartCard() {
  const { weekStartsOn, setWeekStartsOn } = useWeekStartsOn();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Week Starts On</CardTitle>
        <CardDescription>
          Controls when weekly goals reset, calendar week boundaries, and meal planning weeks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStartsOn(0)}
            className={cn(
              'px-4 py-2 rounded-l-md text-sm font-medium border transition-colors',
              weekStartsOn === 0
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            )}
          >
            Sunday
          </button>
          <button
            onClick={() => setWeekStartsOn(1)}
            className={cn(
              'px-4 py-2 rounded-r-md text-sm font-medium border border-l-0 transition-colors',
              weekStartsOn === 1
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            )}
          >
            Monday
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
