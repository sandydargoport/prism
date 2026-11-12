'use client';

/**
 * Edit another screen from this device (#1153), over a live picture of it.
 *
 * The picture is the screen's real dashboard, in a frame of the screen's own
 * size scaled down to fit, so it lays out exactly as it does on the wall. It
 * opens in edit mode, and its editing bar is drawn here at this device's own
 * size (see remoteEdit.ts). The screen shows "Being edited from a phone"
 * while this page is open; on Done its settings and dashboard are sent to it
 * and it shows the result within a few seconds.
 */
import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { useLayouts } from '@/lib/hooks/useLayouts';
import type { ScreenSettings } from '@/lib/displays/screenSettings';
import { changedSettings, REMOTE_EDIT_GLOBAL, type RemoteEditHost } from '@/lib/displays/remoteEdit';

type Entry = {
  id: string;
  name: string;
  online: boolean;
  dashboardId: string | null;
  settings: ScreenSettings;
  width: number | null;
  height: number | null;
};

/** What a screen that never reported its size is shown as. */
const FALLBACK = { width: 1920, height: 1080 };
/** The editing note is renewed this often while the page is open. */
const RENEW_MS = 60 * 1000;
/** The picture never takes more of the page's height than this. */
const PICTURE_MAX_HEIGHT = 0.45;

const LIST = '/settings?section=displays';

function markEditing(id: string, editing: boolean, keepalive = false): Promise<unknown> {
  return fetch(`/api/displays/${id}/editing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editing }),
    keepalive,
  }).catch(() => null);
}

export function RemoteScreenEditor({ id }: { id: string }) {
  const router = useRouter();
  const { activeUser, requireAuth } = useAuth();
  const { layouts, loading: layoutsLoading } = useLayouts();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<Entry | null>(null);
  const [missing, setMissing] = useState(false);
  const [host, setHost] = useState<RemoteEditHost | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 0, height: 0, top: 0 });
  // The dashboard the frame is on; undefined until it says.
  const chosen = useRef<{ id: string; isDefault: boolean } | undefined>(undefined);
  const original = useRef<ScreenSettings>({});
  const finishing = useRef(false);

  // A parent only, as on the screen itself.
  useEffect(() => {
    let live = true;
    void (async () => {
      const user = activeUser ?? await requireAuth('Sign in to edit', "Enter a parent's PIN to edit this screen.");
      if (live) setAllowed(user?.role === 'parent');
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void (async () => {
      const res = await fetch('/api/displays').catch(() => null);
      const data = res?.ok ? await res.json() : null;
      const found = (data?.displays as Entry[] | undefined)?.find((d) => d.id === id) ?? null;
      if (!found) setMissing(true);
      else setScreen(found);
    })();
  }, [allowed, id]);

  const size = screen?.width && screen.height ? { width: screen.width, height: screen.height } : FALLBACK;

  const finish = useCallback(async (saved: boolean) => {
    if (!screen || !host || finishing.current) return;
    finishing.current = true;
    setSaving(true);
    setProblem(null);
    try {
      if (saved) {
        const body: { settings?: Record<string, string | null>; dashboardId?: string | null } = {};
        const changes = changedSettings(original.current, host.settings);
        if (Object.keys(changes).length > 0) body.settings = changes;
        // Whichever dashboard was on show at Done is the screen's from now on.
        const defaultId = layouts.find((l) => l.isDefault)?.id ?? null;
        const before = screen.dashboardId ?? defaultId;
        const pick = chosen.current;
        if (pick && pick.id !== before) body.dashboardId = pick.isDefault ? null : pick.id;
        if (Object.keys(body).length > 0) {
          const res = await fetch(`/api/displays/${screen.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }).catch(() => null);
          if (!res?.ok) {
            setProblem(`The dashboard is saved, but ${screen.name}'s own settings did not reach it. Try again.`);
            finishing.current = false;
            setSaving(false);
            return;
          }
        }
      }
      await markEditing(screen.id, false);
      router.push(saved ? `${LIST}&edited=${screen.id}` : LIST);
    } catch {
      finishing.current = false;
      setSaving(false);
    }
  }, [screen, host, layouts, router]);
  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; }, [finish]);

  // Once the screen and the dashboards are known: the host the frame looks
  // for, and which dashboard the frame opens on. Set once, so the frame is
  // not reloaded under someone editing.
  useEffect(() => {
    if (!screen || layoutsLoading || host || !rootRef.current) return;
    original.current = { ...screen.settings };
    const next: RemoteEditHost = {
      displayId: screen.id,
      dashboardId: screen.dashboardId,
      settings: { ...screen.settings },
      settingsUpdatedAt: null,
      root: rootRef.current,
      onDashboard: (layoutId, isDefault) => { chosen.current = { id: layoutId, isDefault }; },
      onFinish: (saved) => { void finishRef.current(saved); },
    };
    (window as unknown as Record<string, unknown>)[REMOTE_EDIT_GLOBAL] = next;
    const home = layouts.find((l) => l.id === screen.dashboardId);
    const query = `?edit=1&screen=${encodeURIComponent(screen.id)}`;
    setSrc(home && !home.isDefault && home.slug ? `/d/${home.slug}${query}` : `/${query}`);
    setHost(next);
  }, [screen, layouts, layoutsLoading, host]);

  useEffect(() => () => {
    delete (window as unknown as Record<string, unknown>)[REMOTE_EDIT_GLOBAL];
  }, []);

  // The screen says it is being edited while this page is open.
  useEffect(() => {
    if (!host) return;
    void markEditing(host.displayId, true);
    const timer = setInterval(() => void markEditing(host.displayId, true), RENEW_MS);
    const leave = () => { if (!finishing.current) void markEditing(host.displayId, false, true); };
    window.addEventListener('pagehide', leave);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [host]);

  // The room the picture has: the page's width, and part of its height.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRoom({ width: r.width, height: window.innerHeight * PICTURE_MAX_HEIGHT, top: r.top });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [screen]);

  const scale = useMemo(() => {
    if (!room.width) return 0;
    return Math.min(room.width / size.width, room.height / size.height);
  }, [room, size.width, size.height]);
  const shown = { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };

  if (allowed === false) {
    return (
      <Page>
        <p className="text-body text-muted-foreground">Only a parent can edit a screen.</p>
      </Page>
    );
  }
  if (missing) {
    return (
      <Page>
        <p className="text-body text-muted-foreground">That screen is no longer named. It may have been removed.</p>
      </Page>
    );
  }

  const sheetRoom = room.top + shown.height;
  return (
    <Page title={screen ? `Editing ${screen.name}` : 'Editing a screen'}>
      {screen && (
        <p className="m-0 mb-3 text-caption text-muted-foreground" data-remote-status>
          {screen.online ? 'On now' : `Off. ${screen.name} shows the changes when it is next switched on`}
          {' · '}
          {screen.width && screen.height
            ? `${size.width} × ${size.height}`
            : `shown at ${size.width} × ${size.height} until it reports its size`}
        </p>
      )}
      <div ref={boxRef} className="flex w-full justify-center">
        {src && scale > 0 && (
          <div
            className="relative overflow-hidden rounded-xl bg-black shadow-xl ring-1 ring-border"
            style={{ width: shown.width, height: shown.height }}
            data-remote-picture
          >
            <iframe
              title={`${screen?.name ?? 'Screen'}, live`}
              src={src}
              className="absolute left-0 top-0 origin-top-left border-0"
              style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
              data-remote-frame
            />
            {saving && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-body text-white">Saving…</div>
            )}
          </div>
        )}
      </div>
      {problem && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 text-body text-destructive">
          {problem}
          <button type="button" className="min-h-[44px] rounded-full border border-border px-4 text-foreground" onClick={() => void finish(true)}>
            Try again
          </button>
        </div>
      )}
      {/* The frame draws its editing bar and dialogs here. */}
      <div
        ref={rootRef}
        data-remote-edit-root
        style={{ '--remote-sheet-max-h': `max(14rem, calc(100dvh - ${Math.round(sheetRoom)}px - 12rem))` } as React.CSSProperties}
      />
    </Page>
  );
}

function Page({ title = 'Editing a screen', children }: { title?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-background px-4 pb-40 pt-[max(1rem,env(safe-area-inset-top))] text-foreground">
      <Link href={LIST} className="mb-2 inline-flex min-h-[44px] items-center gap-1 text-body text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Screens
      </Link>
      <h1 className="m-0 mb-1 text-title font-medium" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
      {children}
    </main>
  );
}
