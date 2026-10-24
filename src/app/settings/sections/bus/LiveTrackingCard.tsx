'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  BUS_MAP_CAMERAS, BUS_MAP_CAMERA_LABELS, BUS_MAP_CAMERA_SETTING, BUS_MAP_STYLES, BUS_MAP_STYLE_LABELS,
  BUS_MAP_STYLE_SETTING, DEFAULT_BUS_MAP_CAMERA, DEFAULT_BUS_MAP_STYLE, isBusMapCamera, isBusMapStyle,
} from '@/lib/map/busMapOptions';
import { BUS_DRIVER_NAMES_SETTING, isDriverNames, type DriverNames } from '@/lib/services/bus-driver-names';
import { useFetchOnMount } from '@/lib/hooks/useFetchOnMount';

interface LiveTrack {
  id: string;
  provider: string;
  label: string | null;
  direction: 'AM' | 'PM' | null;
  tripDate: string;
  routeId: string | null;
  lastFixAt: string | null;
  driverName: string | null;
}

interface RouteOption {
  id: string;
  label: string;
}

const RECEIVING_MS = 10 * 60 * 1000;
const UNLINKED = 'none';

/** One row per trip the provider reports, newest day first. */
function groupTracks(tracks: LiveTrack[]): LiveTrack[] {
  const seen = new Map<string, LiveTrack>();
  for (const t of tracks) {
    const k = `${t.provider}|${t.label ?? ''}|${t.direction ?? ''}`;
    if (!seen.has(k)) seen.set(k, t);
  }
  return [...seen.values()];
}

/**
 * Live position provider settings: the token a provider posts with, which
 * route each reported trip is, and how long the history is kept.
 */
export function LiveTrackingCard({ routes, onBound }: { routes: RouteOption[]; onBound: () => void }) {
  const [tracks, setTracks] = useState<LiveTrack[]>([]);
  const [lastReceivedAt, setLastReceivedAt] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [traceDays, setTraceDays] = useState('30');
  const [historyDays, setHistoryDays] = useState('365');
  const [savedDays, setSavedDays] = useState({ trace: '30', history: '365' });
  const [mapStyle, setMapStyle] = useState<string>(DEFAULT_BUS_MAP_STYLE);
  const [camera, setCamera] = useState<string>(DEFAULT_BUS_MAP_CAMERA);
  const [driverNames, setDriverNames] = useState<DriverNames>({});
  const [savedDriverNames, setSavedDriverNames] = useState<DriverNames>({});
  const [accuracy, setAccuracy] = useState<RouteAccuracy[]>([]);

  const load = useCallback(async () => {
    try {
      const [tracksRes, settingsRes, accuracyRes] = await Promise.all([
        fetch('/api/bus-tracking/live/tracks'),
        fetch('/api/settings'),
        fetch('/api/bus-tracking/accuracy'),
      ]);
      if (accuracyRes.ok) setAccuracy((await accuracyRes.json()).routes ?? []);
      if (tracksRes.ok) {
        const data = await tracksRes.json();
        setTracks(data.tracks);
        setLastReceivedAt(data.lastReceivedAt);
        setReceiving(data.lastReceivedAt !== null && Date.now() - new Date(data.lastReceivedAt).getTime() < RECEIVING_MS);
      }
      if (settingsRes.ok) {
        const all = await settingsRes.json();
        const trace = String(all.busTraceRetentionDays ?? 30);
        const history = String(all.busHistoryRetentionDays ?? 365);
        setTraceDays(trace);
        setHistoryDays(history);
        setSavedDays({ trace, history });
        if (isBusMapStyle(all.busMapStyle)) setMapStyle(all.busMapStyle);
        if (isBusMapCamera(all.busMapCamera)) setCamera(all.busMapCamera);
        if (isDriverNames(all.busDriverNames)) {
          setDriverNames(all.busDriverNames);
          setSavedDriverNames(all.busDriverNames);
        }
      }
    } catch {
      // Leave the defaults showing.
    }
  }, []);

  useFetchOnMount(load);

  const trips = useMemo(() => groupTracks(tracks), [tracks]);
  const drivers = useMemo(
    () => [...new Set(tracks.map(t => t.driverName).filter((n): n is string => Boolean(n)))].sort(),
    [tracks],
  );

  const handleCreateToken = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/auth/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bus live provider', scopes: ['bus:ingest'] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewToken(data.token);
    } catch {
      toast({ title: 'Failed to create token', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleBind = async (track: LiveTrack, value: string) => {
    try {
      const res = await fetch('/api/bus-tracking/live/tracks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id, routeId: value === UNLINKED ? null : value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
      onBound();
      toast({ title: value === UNLINKED ? 'Trip unlinked' : 'Trip linked to route' });
    } catch {
      toast({ title: 'Failed to link trip', variant: 'destructive' });
    }
  };

  const handleSaveRetention = async () => {
    const pairs: [string, string][] = [
      ['busTraceRetentionDays', traceDays],
      ['busHistoryRetentionDays', historyDays],
    ];
    try {
      for (const [key, value] of pairs) {
        const res = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: Number(value) }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      setSavedDays({ trace: traceDays, history: historyDays });
      toast({ title: 'Retention saved' });
    } catch {
      toast({ title: 'Failed to save retention', description: 'Use whole days: trace 1 to 365, history 1 to 1825.', variant: 'destructive' });
    }
  };

  /** Save one map choice, putting the old value back if the save fails. */
  const saveChoice = async (key: string, next: string, previous: string, set: (v: string) => void) => {
    set(next);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      set(previous);
      toast({ title: 'Failed to save the map setting', variant: 'destructive' });
    }
  };

  const saveDriverName = async (reported: string) => {
    if ((driverNames[reported] ?? '') === (savedDriverNames[reported] ?? '')) return;
    const next = { ...savedDriverNames, [reported]: (driverNames[reported] ?? '').trim() };
    if (!next[reported]) delete next[reported];
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: BUS_DRIVER_NAMES_SETTING, value: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedDriverNames(next);
      toast({ title: 'Driver name saved' });
    } catch {
      toast({ title: 'Failed to save driver name', variant: 'destructive' });
    }
  };

  const retentionDirty = traceDays !== savedDays.trace || historyDays !== savedDays.history;
  const ingestUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/bus-tracking/live/ingest` : '';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Live Tracking</CardTitle>
              <CardDescription>
                Show the bus moving on a map, from a live position provider.
              </CardDescription>
            </div>
          </div>
          {receiving ? (
            <Badge variant="default" className="bg-success">Receiving</Badge>
          ) : (
            <Badge variant="secondary">
              {lastReceivedAt ? `Last update ${new Date(lastReceivedAt).toLocaleString()}` : 'Nothing received yet'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            A provider posts positions to <code className="text-xs">{ingestUrl}</code> with a token that can do nothing else.
          </p>
          {newToken ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{newToken}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { void navigator.clipboard?.writeText(newToken); toast({ title: 'Token copied' }); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Shown once. Revoke it under Security if it is ever exposed.</p>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={handleCreateToken} disabled={creating}>
              <KeyRound className="h-4 w-4 mr-1" />
              {creating ? 'Creating...' : 'Create provider token'}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Trips reported this week</Label>
          {trips.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet. They appear here once a provider sends today&apos;s trips.</p>
          ) : (
            <div className="space-y-2">
              {trips.map(track => (
                <div key={track.id} className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {track.label ?? 'Unnamed trip'}{track.direction ? ` · ${track.direction}` : ''}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {track.provider} · last seen {track.tripDate}
                    </div>
                  </div>
                  <Select value={track.routeId ?? UNLINKED} onValueChange={(v) => handleBind(track, v)}>
                    <SelectTrigger className="h-8 w-44 text-sm" aria-label="Route for this trip">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNLINKED}>Not linked</SelectItem>
                      {routes.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>

        {drivers.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">Drivers this week</Label>
            <div className="space-y-1.5">
              {drivers.map(reported => (
                <div key={reported} className="flex items-center gap-3">
                  <span className="w-40 truncate text-sm" title={reported}>{reported}</span>
                  <Input
                    value={driverNames[reported] ?? ''}
                    onChange={e => setDriverNames(d => ({ ...d, [reported]: e.target.value }))}
                    onBlur={() => saveDriverName(reported)}
                    placeholder="Shown as, e.g. Mr. Lastname"
                    maxLength={60}
                    className="h-8 w-56 text-sm"
                    aria-label={`How to show ${reported}`}
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              How each driver appears on the display. Left blank, the name shows as the provider reports it.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <ChoiceList
            label="Map style"
            options={BUS_MAP_STYLES}
            labels={BUS_MAP_STYLE_LABELS}
            value={mapStyle}
            onChange={v => saveChoice(BUS_MAP_STYLE_SETTING, v, mapStyle, setMapStyle)}
          />
          <ChoiceList
            label="Camera"
            options={BUS_MAP_CAMERAS}
            labels={BUS_MAP_CAMERA_LABELS}
            value={camera}
            onChange={v => saveChoice(BUS_MAP_CAMERA_SETTING, v, camera, setCamera)}
          />
          <p className="text-[11px] text-muted-foreground">
            The map turns dark with Prism&apos;s theme. Zoom with its + and - buttons; the camera takes over again a minute later.
          </p>
        </div>

        <AccuracySection routes={accuracy} />

        <div className="space-y-2">
          <Label className="text-xs">Keep history</Label>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Input
                type="number" min={1} max={365} value={traceDays}
                onChange={e => setTraceDays(e.target.value)}
                className="h-8 w-24 text-sm" aria-label="Days to keep the exact trace"
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">days of exact route</p>
            </div>
            <div>
              <Input
                type="number" min={1} max={1825} value={historyDays}
                onChange={e => setHistoryDays(e.target.value)}
                className="h-8 w-24 text-sm" aria-label="Days to keep stop times"
              />
              <p className="text-[11px] text-muted-foreground mt-0.5">days of stop times</p>
            </div>
            {retentionDirty && (
              <Button size="sm" onClick={handleSaveRetention}>
                <Check className="h-4 w-4 mr-1" /> Save
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            The exact route is where the bus was minute by minute. Stop times are only when it reached each stop, which is what arrival predictions learn from. Both stay on this server.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChoiceList<T extends string>({
  label, options, labels, value, onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="space-y-1" role="radiogroup" aria-label={label}>
        {options.map(option => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-left text-sm transition-colors',
              value === option ? 'border-primary bg-accent' : 'border-border hover:bg-accent',
            )}
          >
            <span className={cn(
              'h-3 w-3 shrink-0 rounded-full border',
              value === option ? 'border-primary bg-primary' : 'border-muted-foreground',
            )} />
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

interface HorizonAccuracy {
  horizonMin: number;
  trips: number;
  typicalMin: number | null;
  within80Min: number | null;
  biasMin: number | null;
}

interface RouteAccuracy {
  routeId: string;
  label: string | null;
  horizons: HorizonAccuracy[];
}

/** Below this many scored trips a lead time shows as still collecting. */
const MIN_SCORED_TRIPS = 3;

const minutes = (m: number) => (m < 1 ? 'under 1 min' : `${Math.round(m)} min`);

/** Which way the projection leans, in words: positive bias means the bus came later than shown. */
function leaning(bias: number | null): string {
  if (bias === null || Math.abs(bias) < 0.5) return 'on target';
  return bias > 0 ? `bus ${minutes(bias)} later` : `bus ${minutes(-bias)} earlier`;
}

/**
 * How close the arrival times have been, per route and lead time, measured
 * against when the bus actually reached the stop.
 */
function AccuracySection({ routes }: { routes: RouteAccuracy[] }) {
  const scored = routes.filter((r) => r.horizons.some((h) => h.trips > 0));
  return (
    <div className="space-y-2">
      <Label className="text-xs">Arrival time accuracy</Label>
      {scored.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nothing measured yet. Each trip that reaches your stop is scored at 20, 15, 10, 5 and 2 minutes out; days without a bus are not counted.
        </p>
      ) : scored.map((route) => (
        <div key={route.routeId} className="space-y-1">
          {scored.length > 1 && <div className="text-xs font-medium">{route.label ?? 'Route'}</div>}
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="font-normal pr-2">Shown</th>
                <th className="font-normal pr-2">Trips</th>
                <th className="font-normal pr-2">Typical miss</th>
                <th className="font-normal pr-2">4 in 5 within</th>
                <th className="font-normal">Leans</th>
              </tr>
            </thead>
            <tbody>
              {route.horizons.map((h) => {
                const enough = h.trips >= MIN_SCORED_TRIPS;
                return (
                  <tr key={h.horizonMin}>
                    <td className="pr-2">{h.horizonMin} min out</td>
                    <td className="pr-2 tabular-nums">{h.trips}</td>
                    <td className="pr-2">{enough && h.typicalMin !== null ? minutes(h.typicalMin) : '...'}</td>
                    <td className="pr-2">{enough && h.within80Min !== null ? minutes(h.within80Min) : '...'}</td>
                    <td>{enough ? leaning(h.biasMin) : 'collecting'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">
        Scored only on trips that reached your stop, never on days without a bus. Shown after {MIN_SCORED_TRIPS} trips.
      </p>
    </div>
  );
}
