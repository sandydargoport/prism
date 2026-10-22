'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

interface LiveTrack {
  id: string;
  provider: string;
  label: string | null;
  direction: 'AM' | 'PM' | null;
  tripDate: string;
  routeId: string | null;
  lastFixAt: string | null;
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

  const load = useCallback(async () => {
    try {
      const [tracksRes, settingsRes] = await Promise.all([
        fetch('/api/bus-tracking/live/tracks'),
        fetch('/api/settings'),
      ]);
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
      }
    } catch {
      // Leave the defaults showing.
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const trips = useMemo(() => groupTracks(tracks), [tracks]);

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
