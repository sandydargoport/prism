'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useFetchOnMount } from '@/lib/hooks/useFetchOnMount';

interface DeviceRow {
  id: string;
  device: string;
  createdAt: number;
  lastUsedAt?: number;
  kept: boolean;
  current: boolean;
}

const SHOWN = 5;

function when(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Keep this device signed in, and the devices signed in as you (#1044).
 * A kept phone slides a month from last use and lasts up to a year; any of
 * them can be signed out from here, so a lost phone is one tap away.
 */
export function SignedInDevices() {
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/auth/sessions');
    if (!res.ok) { setRows([]); return; }
    setRows(((await res.json()).sessions ?? []) as DeviceRow[]);
  }, []);
  useFetchOnMount(load);

  const current = rows?.find((r) => r.current);
  const others = rows?.filter((r) => !r.current) ?? [];
  // Every sign-in and PIN check is a session, so the list can run long: the
  // most recently used few, and one button for the rest.
  const shown = others.slice(0, SHOWN);
  const hidden = others.length - shown.length;

  const keep = async (next: boolean) => {
    setBusy('keep');
    try {
      await fetch('/api/auth/sessions/keep', { method: next ? 'POST' : 'DELETE' });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const signOut = async (id: string) => {
    setBusy(id);
    try {
      const q = id === 'others' ? 'others=1' : `id=${encodeURIComponent(id)}`;
      await fetch(`/api/auth/sessions?${q}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card data-signed-in-devices>
      <CardHeader>
        <CardTitle>Signed-in devices</CardTitle>
        <CardDescription>
          Keep a phone you use every day signed in: it stays signed in for a month after it was
          last used, up to a year. Sign out any device here, for example one that was lost.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current && (
          <div className="flex items-center justify-between gap-4" data-device-current>
            <div className="min-w-0">
              <p className="font-medium">This device</p>
              <p className="text-sm text-muted-foreground">
                {current.kept
                  ? 'Kept signed in, while it is used at least once a month.'
                  : 'Signs out a week after you sign in. Keep it to sign in less often.'}
              </p>
            </div>
            <Button
              variant={current.kept ? 'outline' : 'default'}
              disabled={busy !== null}
              onClick={() => keep(!current.kept)}
              data-keep-signed-in
              aria-pressed={current.kept}
            >
              {current.kept ? 'Stop keeping' : 'Keep signed in'}
            </Button>
          </div>
        )}
        {others.length > 0 && (
          <ul className="divide-y border-t" data-device-list>
            {shown.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-3" data-device-row={r.id}>
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.device}{r.kept ? ' · kept' : ''}</p>
                  <p className="text-sm text-muted-foreground">
                    Signed in {when(r.createdAt)}{r.lastUsedAt ? ` · last used ${when(r.lastUsedAt)}` : ''}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => signOut(r.id)} data-device-sign-out>
                  Sign out
                </Button>
              </li>
            ))}
          </ul>
        )}
        {others.length > 0 && (
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <p className="text-sm text-muted-foreground" data-device-more>
              {hidden > 0
                ? `${hidden} more ${hidden === 1 ? 'device' : 'devices'} not shown.`
                : `${others.length} other ${others.length === 1 ? 'device' : 'devices'}.`}
            </p>
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => signOut('others')} data-device-sign-out-others>
              Sign out all other devices
            </Button>
          </div>
        )}
        {rows !== null && !current && others.length === 0 && (
          <p className="text-sm text-muted-foreground">No devices are signed in as you.</p>
        )}
      </CardContent>
    </Card>
  );
}
