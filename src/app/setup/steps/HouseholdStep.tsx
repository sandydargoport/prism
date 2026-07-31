'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Home, ChevronRight, Search, MapPin, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocationSearch } from '@/lib/hooks/useLocationSearch';
import { useTimezone, detectBrowserTimezone } from '@/lib/hooks/useTimezone';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { listTimezones } from '@/lib/utils/timezone';

interface HouseholdStepProps {
  onNext: () => void;
  onBack: () => void;
}

/**
 * Replaces the old Weather/Calendar/Microsoft wizard steps with a single,
 * entirely keyless "household basics" step: location (for local weather),
 * time zone, and week-start-day. No API keys or accounts — those integrations
 * now live on their own pages (Calendar, Settings) and are reached after
 * setup finishes.
 */
export function HouseholdStep({ onNext, onBack }: HouseholdStepProps) {
  const { query, setQuery, savedName, candidates, searching, saving, select, clear } = useLocationSearch();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setOpen(candidates.length > 0);
  }, [candidates]);

  const { timezone, setTimezone, loading: tzLoading } = useTimezone();
  const detected = detectBrowserTimezone();
  const zones = listTimezones();
  const tzOptions = zones.includes(timezone) ? zones : [timezone, ...zones];

  const { weekStartsOn, setWeekStartsOn } = useWeekStartsOn();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          <CardTitle>Household Basics</CardTitle>
        </div>
        <CardDescription>
          A few quick defaults — no accounts or API keys needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Location */}
        <div className="space-y-1">
          <Label htmlFor="household-location">Location</Label>
          <p className="text-xs text-muted-foreground">Set your location for local weather</p>

          {savedName && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{savedName}</span>
              <button
                type="button"
                onClick={clear}
                disabled={saving}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear location"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div ref={wrapperRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
              )}
              <Input
                id="household-location"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => candidates.length > 0 && setOpen(true)}
                placeholder="Search city or ZIP…"
                className="pl-9"
                autoComplete="off"
              />
            </div>

            {open && candidates.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
                {candidates.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setOpen(false); select(c); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-accent transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {c.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Time zone */}
        <div className="space-y-1">
          <Label htmlFor="household-timezone">Time zone</Label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="household-timezone"
              value={timezone}
              disabled={tzLoading}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-9 flex-1 min-w-[14rem] rounded-md border border-border bg-background px-3 text-sm"
            >
              {tzOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            {detected && detected !== timezone && (
              <Button type="button" variant="outline" size="sm" onClick={() => setTimezone(detected)}>
                Use detected
              </Button>
            )}
          </div>
        </div>

        {/* Week start */}
        <div className="space-y-1">
          <Label>Week starts on</Label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStartsOn(0)}
              className={cn(
                'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                weekStartsOn === 0 ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
              )}
            >
              Sunday
            </button>
            <button
              type="button"
              onClick={() => setWeekStartsOn(1)}
              className={cn(
                'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                weekStartsOn === 1 ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
              )}
            >
              Monday
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
          <Button onClick={onNext} className="flex-1">
            Continue <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground -mt-1">
          <button type="button" onClick={onNext} className="hover:underline">
            Skip for now
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
