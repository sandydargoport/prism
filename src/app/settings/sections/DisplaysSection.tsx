'use client';

import { useCallback, useState } from 'react';
import { formatDistance } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useFetchOnMount } from '@/lib/hooks/useFetchOnMount';

/**
 * Settings > Displays (#690): name this screen, and see every named screen with
 * whether it is on. Per-screen settings will be edited from here too, so one
 * section serves every screen rather than a page per screen.
 */

type DisplayEntry = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  online: boolean;
};

const NAME_MAX = 60;

function statusText(d: DisplayEntry, now: number): string {
  if (d.online) return 'Online';
  if (!d.lastSeenAt) return 'Not seen yet';
  return `Last seen ${formatDistance(new Date(d.lastSeenAt), now, { addSuffix: true })}`;
}

async function errorFrom(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) return 'Only a parent can name or change displays.';
  return data?.error ?? 'That did not work. Try again.';
}

export function DisplaysSection() {
  const [displays, setDisplays] = useState<DisplayEntry[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // "Last seen 3 hours ago" is measured from when the list was fetched.
  const [fetchedAt, setFetchedAt] = useState(0);
  const [authWall, setAuthWall] = useState(false);
  const [trusted, setTrusted] = useState(false);

  const [newName, setNewName] = useState('');
  const [alsoTrust, setAlsoTrust] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, settings] = await Promise.all([fetch('/api/displays'), fetch('/api/settings')]);
      if (list.ok) {
        const data = await list.json();
        setDisplays(data.displays);
        setCurrentId(data.currentId);
        setFetchedAt(Date.now());
      }
      if (settings.ok) {
        const data = await settings.json();
        const security = data?.security ?? data?.settings?.security;
        setAuthWall(security?.authWall?.enabled === true);
      }
      setTrusted(document.cookie.split('; ').includes('prism_trusted_display=1'));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFetchOnMount(load);

  const run = async (action: () => Promise<Response>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await action();
      if (!res.ok) {
        setError(await errorFrom(res));
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const nameThisDisplay = async () => {
    const ok = await run(() => fetch('/api/displays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    }));
    if (!ok) return;
    setNewName('');
    // Trusting stays its own decision on the server (naming a phone must not
    // exempt it from sign-in); this only saves a second trip to Security.
    if (authWall && !trusted && alsoTrust) {
      const res = await fetch('/api/auth/trust-device', { method: 'POST' });
      if (res.ok) {
        // Same readable marker SecuritySection keeps for the httpOnly cookie.
        document.cookie = 'prism_trusted_display=1; path=/; max-age=157680000';
        setTrusted(true);
      }
    }
  };

  const rename = async (id: string) => {
    const ok = await run(() => fetch(`/api/displays/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    }));
    if (ok) setEditingId(null);
  };

  const remove = async (d: DisplayEntry) => {
    const what = d.id === currentId ? 'this screen' : `"${d.name}"`;
    if (!window.confirm(`Forget ${what}? It goes back to being an unnamed browser.`)) return;
    await run(() => fetch(`/api/displays/${d.id}`, { method: 'DELETE' }));
  };

  const current = displays.find((d) => d.id === currentId) ?? null;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Displays</h2>
        <p className="text-muted-foreground">
          Name each screen in the house, so you can see which ones are on and, later,
          change a screen&apos;s settings from your phone. A browser nobody named works
          just as it always has.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>This screen</CardTitle>
          <CardDescription>
            {current
              ? <>This screen is named <strong>{current.name}</strong>.</>
              : 'Name it from the screen itself, for example "Kitchen" or "Upstairs hall".'}
          </CardDescription>
        </CardHeader>
        {loaded && !current && (
          <CardContent className="space-y-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); void nameThisDisplay(); }}
            >
              <Input
                aria-label="Name for this screen"
                placeholder="Kitchen"
                maxLength={NAME_MAX}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button type="submit" disabled={busy || !newName.trim()}>
                Name this display
              </Button>
            </form>
            {authWall && !trusted && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={alsoTrust}
                  onChange={(e) => setAlsoTrust(e.target.checked)}
                />
                Also trust it, so it stays readable without anyone signing in
              </label>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All screens</CardTitle>
          <CardDescription>A screen shows as online while it is switched on.</CardDescription>
        </CardHeader>
        <CardContent>
          {loaded && displays.length === 0 && (
            <p className="text-sm text-muted-foreground">No screens are named yet.</p>
          )}
          <ul className="divide-y divide-border">
            {displays.map((d) => (
              <li key={d.id} data-testid="display-row" className="flex flex-wrap items-center gap-3 py-3">
                {editingId === d.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => { e.preventDefault(); void rename(d.id); }}
                  >
                    <Input
                      aria-label={`New name for ${d.name}`}
                      maxLength={NAME_MAX}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <Button type="submit" size="sm" disabled={busy || !editName.trim()}>Save</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{d.name}</span>
                        {d.id === currentId && <Badge variant="secondary">This screen</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span
                          className={d.online ? 'inline-block h-2 w-2 rounded-full bg-green-500 mr-1.5' : 'inline-block h-2 w-2 rounded-full bg-muted-foreground/40 mr-1.5'}
                          aria-hidden
                        />
                        {statusText(d, fetchedAt)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => { setEditingId(d.id); setEditName(d.name); }}
                    >
                      Rename
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove(d)}>
                      Remove
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
