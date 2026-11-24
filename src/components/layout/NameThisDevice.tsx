'use client';

/**
 * Naming the device in use as a screen (#1267), in the editor where the rest
 * of a screen is set up, rather than in Settings, which is now only the list.
 *
 * A device nobody named shows the default dashboard. Named, it is a screen:
 * it shows a dashboard of its own choosing and can switch to others at bus
 * time or set times (#1282), and it can be edited from any other device. It
 * can also become a screen named before (after a browser reset, say), taking
 * that screen's name and settings.
 */
import * as React from 'react';
import { useState } from 'react';
import { resetSyncBase, syncScreenSettings } from '@/lib/displays/displaySettingsSync';
import { releaseHeldSettings } from '@/lib/displays/remoteEdit';
import { cn } from '@/lib/utils';

const NAME_MAX = 60;
const TRUSTED_MARK = 'prism_trusted_display=1';

type Named = { id: string; name: string };

async function problemFrom(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 403) return 'Only a parent can name a screen.';
  return data?.error ?? 'That did not work. Try again.';
}

export function NameThisDevice({ shows, onNamed, chip, field }: {
  /** The dashboard this device shows while it has no name: the default. */
  shows: string;
  /** Named, or now a screen named before: its id. */
  onNamed: (displayId: string) => void;
  /** The sheet's own control styles, so this reads as part of it. */
  chip: (on: boolean) => string;
  field: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [screens, setScreens] = useState<Named[]>([]);
  const [existing, setExisting] = useState('');
  const [trustOffered, setTrustOffered] = useState(false);
  const [alsoTrust, setAlsoTrust] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /** Opens the form, with the screens named before and whether sign-in is asked for. */
  const start = async () => {
    setOpen(true);
    const [list, settings] = await Promise.all([
      fetch('/api/displays').catch(() => null),
      fetch('/api/settings').catch(() => null),
    ]);
    if (list?.ok) {
      const data = await list.json().catch(() => null);
      setScreens((data?.displays ?? []).map((d: Named) => ({ id: d.id, name: d.name })));
    }
    if (settings?.ok) {
      const data = await settings.json().catch(() => null);
      const security = data?.security ?? data?.settings?.security;
      setTrustOffered(security?.authWall?.enabled === true && !document.cookie.split('; ').includes(TRUSTED_MARK));
    }
  };

  /** Names this device (`{ name }`) or makes it a screen named before (`{ id }`). */
  const become = async (body: { name: string } | { id: string }) => {
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch('/api/displays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setProblem(await problemFrom(res)); return; }
      const { display } = await res.json();
      // Trusting stays its own decision on the server (naming a phone must not
      // exempt it from sign-in); this only saves a trip to Security.
      if (trustOffered && alsoTrust) {
        const trusted = await fetch('/api/auth/trust-device', { method: 'POST' }).catch(() => null);
        // The same readable marker Security keeps for the httpOnly cookie.
        if (trusted?.ok) document.cookie = `${TRUSTED_MARK}; path=/; max-age=157680000`;
      }
      // A new screen takes what this device has as its settings, sent now; a
      // screen named before brings its own. Either way it then opens as that
      // screen (#1282), which loads them afresh.
      // In the editor's frame its settings were held until Done (#1341);
      // named, they are its browser's again, where the sync writes them.
      releaseHeldSettings();
      resetSyncBase();
      await syncScreenSettings();
      setOpen(false);
      onNamed(display.id);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-name-device>
        <span className="text-caption text-muted-foreground">This device has no name, so it shows {shows}. Named, it can show another and switch at bus time.</span>
        <button type="button" className={chip(false)} onClick={() => void start()} data-name-device-open>
          Name this device
        </button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => { e.preventDefault(); if (name.trim()) void become({ name }); }}
      data-name-device-form
    >
      <span className="text-body">Name it as a screen, for example the room it is in.</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={cn(field, 'min-w-0 flex-1')}
          aria-label="Name for this screen"
          placeholder="Kitchen"
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <button type="submit" className={chip(true)} disabled={busy || !name.trim()}>Name it</button>
        <button type="button" className={chip(false)} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {screens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-body">
          Or it is
          <select className={field} aria-label="Existing screen" value={existing} onChange={(e) => setExisting(e.target.value)}>
            <option value="">a screen named before</option>
            {screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" className={chip(false)} disabled={busy || !existing} onClick={() => void become({ id: existing })}>
            Use its name and settings
          </button>
        </div>
      )}
      {trustOffered && (
        <label className="flex items-center gap-2 text-caption">
          <input type="checkbox" checked={alsoTrust} onChange={(e) => setAlsoTrust(e.target.checked)} />
          Also trust it, so it stays readable without anyone signing in
        </label>
      )}
      {problem && <p role="alert" className="m-0 text-body text-destructive">{problem}</p>}
    </form>
  );
}
