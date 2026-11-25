'use client';

/**
 * The canvas editor (#1153, #1265): a dashboard edited over a live picture of
 * it, at the size of the screen it is for.
 *
 * The picture is the real dashboard, in a frame of the screen's own size
 * scaled down to fit, so it lays out exactly as it does on the wall. It opens
 * in edit mode, and its panels are drawn here at this device's own size (see
 * remoteEdit.ts): beside the picture on a laptop, below it on a phone, so the
 * picture is never covered and never moves when a panel opens.
 *
 * Two ways in:
 *   - a named screen (/screens/[id]): the dashboard it shows now, or the
 *     one Edit was pressed on, at its size. Another device editing it makes
 *     the screen show "Being edited from a phone" while this page is open,
 *     and on Done its own settings, its dashboard and its switches (#1282)
 *     are sent to it; Cancel sends nothing. The screen itself opens its own
 *     editor here too (#1280), and on Done takes them at once and goes back
 *     to its dashboard.
 *   - a dashboard (/edit/[id]), from a device that is not a named screen: at
 *     the size of a screen that shows it, or one picked here. This device's
 *     own settings apply, held here until Done writes them to this browser;
 *     Cancel drops them (#1341).
 */
import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { useLayouts, type Layout } from '@/lib/hooks/useLayouts';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { samePlan, screenDashboardAt, screenShows, type ScreenPlan, type ScreenSwitch } from '@/lib/screenSwitches';
import type { ScreenSettings } from '@/lib/displays/screenSettings';
import { changedSettings, REMOTE_EDIT_GLOBAL, type RemoteEditHost } from '@/lib/displays/remoteEdit';
import { ownScreenId, SCREENS_LIST as LIST } from '@/lib/displays/editPlace';
import { useHydrated } from '@/lib/hooks/useStoredValue';
import { useHoldEditing } from '@/lib/hooks/useEditing';
import { MOBILE_BREAKPOINT, useIsMobile } from '@/lib/hooks/useIsMobile';
import { readLocalSettings, syncScreenSettings } from '@/lib/displays/displaySettingsSync';
import { writeStored } from '@/lib/hooks/useStoredValue';

type Entry = {
  id: string;
  name: string;
  online: boolean;
  /** The dashboard it shows (null is the default) and its switches (#1282). */
  dashboardId: string | null;
  switches: ScreenSwitch[];
  settings: ScreenSettings;
  width: number | null;
  height: number | null;
};

type Size = { width: number; height: number };

/** What a screen that never reported its size is shown as. */
const FALLBACK: Size = { width: 1920, height: 1080 };
/** Common sizes, offered after the screens that show a dashboard. */
const COMMON: Size[] = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 2560, height: 1440 },
  { width: 1080, height: 1920 },
  { width: 800, height: 1280 },
];
/** The editing note is renewed this often while the page is open. */
const RENEW_MS = 60 * 1000;
/** On a phone the picture is above the panels and takes no more of the height than this. */
const PICTURE_MAX_HEIGHT = 0.45;
/** Beside the panels, the room kept under the picture for its caption (#1348), in px. */
const CAPTION_ROOM = 48;
/** From this width the panels sit beside the picture (Tailwind's `lg`). */
const SIDE_BY_SIDE = '(min-width: 1024px)';

function markEditing(id: string, editing: boolean, keepalive = false): Promise<unknown> {
  return fetch(`/api/displays/${id}/editing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editing }),
    keepalive,
  }).catch(() => null);
}

const sizeText = (s: Size) => `${s.width} × ${s.height}`;

/** Where a dashboard is shown on its own. */
function dashboardPath(d: Pick<Layout, 'slug' | 'isDefault'> | undefined): string {
  return d?.slug ? `/d/${d.slug}` : '/';
}

export type SizeChoice = { key: string; label: string; size: Size; group: 'shows' | 'other' | 'size' };

/**
 * The sizes a dashboard can be edited at: the named screens that show it at
 * some time, as their own or in a switch, common sizes, then the other named
 * screens. The
 * first is the default. A screen as narrow as a phone shows the phone layout
 * of cards, not the dashboard's grid, so it is not offered (#1280).
 */
export function sizeChoices(dashboard: Pick<Layout, 'id' | 'isDefault'>, displays: Pick<Entry, 'id' | 'name' | 'dashboardId' | 'switches' | 'width' | 'height'>[]): SizeChoice[] {
  const shows = (d: Pick<Entry, 'dashboardId' | 'switches'>) => screenShows({ dashboardId: d.dashboardId, switches: d.switches ?? [] }, dashboard);
  const sized = displays.filter((d) => d.width && d.height && d.width >= MOBILE_BREAKPOINT);
  const screen = (d: Pick<Entry, 'id' | 'name' | 'width' | 'height'>, group: 'shows' | 'other'): SizeChoice => {
    const size = { width: d.width!, height: d.height! };
    return { key: `screen:${d.id}`, label: `${d.name}, ${sizeText(size)}`, size, group };
  };
  return [
    ...sized.filter(shows).map((d) => screen(d, 'shows')),
    ...COMMON.map((size) => ({
      key: `${size.width}x${size.height}`,
      label: `${sizeText(size)}${size.height > size.width ? ', portrait' : ''}`,
      size,
      group: 'size' as const,
    })),
    ...sized.filter((d) => !shows(d)).map((d) => screen(d, 'other')),
  ];
}

export function CanvasEditor(target: { screenId: string; startDashboardId?: string } | { dashboardId: string }) {
  const screenId = 'screenId' in target ? target.screenId : null;
  const dashboardId = 'dashboardId' in target ? target.dashboardId : null;
  const startDashboardId = 'screenId' in target ? target.startDashboardId : undefined;
  const router = useRouter();
  const { activeUser, requireAuth } = useAuth();
  const { layouts, loading: layoutsLoading } = useLayouts();
  const { householdTimezone } = useTimeFormat();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [displays, setDisplays] = useState<Entry[] | null>(null);
  const [host, setHost] = useState<RemoteEditHost | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const aboveRef = useRef<HTMLDivElement>(null);
  const belowRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 0, height: 0 });
  // The screen being edited is this browser (#1280): known once hydrated, as
  // it lives in this browser's storage.
  const hydrated = useHydrated();
  // On a phone the editor says whose it is (#1353): a phone edits a screen, never itself.
  const narrow = useIsMobile();
  const self = hydrated && screenId !== null && ownScreenId() === screenId;
  // The dashboard the frame opened on.
  const startedOn = useRef<Layout | undefined>(undefined);
  // The dashboard the frame is on; undefined until it says.
  const chosen = useRef<{ id: string; isDefault: boolean } | undefined>(undefined);
  const original = useRef<ScreenSettings>({});
  const originalPlan = useRef<ScreenPlan>({ dashboardId: null, switches: [] });
  const finishing = useRef(false);
  // The screen does not go idle over the editor (#1342): taps in the frame never reach this page.
  useHoldEditing(true);

  // A parent only, as on the screen itself.
  useEffect(() => {
    let live = true;
    void (async () => {
      const user = activeUser ?? await requireAuth('Sign in to edit', "Enter a parent's PIN to edit this screen.", { parentsOnly: true });
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
      setDisplays((data?.displays as Entry[] | undefined) ?? []);
    })();
  }, [allowed]);

  const screen = screenId ? displays?.find((d) => d.id === screenId) ?? null : null;
  const dashboard = dashboardId ? layouts.find((l) => l.id === dashboardId) : undefined;
  const missing = screenId
    ? displays !== null && !screen
    : !layoutsLoading && !dashboard;

  const choices = useMemo(
    () => (dashboard && displays ? sizeChoices(dashboard, displays) : []),
    [dashboard, displays],
  );
  const firstChoice = choices.find((c) => c.group === 'shows')?.key ?? `${FALLBACK.width}x${FALLBACK.height}`;
  const picked = choices.find((c) => c.key === (choice ?? firstChoice));
  const size: Size = screen
    ? (screen.width && screen.height ? { width: screen.width, height: screen.height } : FALLBACK)
    : picked?.size ?? FALLBACK;

  const finish = useCallback(async (saved: boolean) => {
    if (!host || finishing.current) return;
    finishing.current = true;
    setSaving(true);
    setProblem(null);
    try {
      const next = saved ? host.next ?? null : null;
      if (!screen) {
        // A dashboard: it is saved already. This device's own settings,
        // held until now (#1341), are written to this browser on Done, and
        // the page loads afresh so they apply; Cancel drops them.
        const changes = saved ? changedSettings(original.current, host.settings) : {};
        for (const [key, raw] of Object.entries(changes)) writeStored(key, raw);
        const at = saved ? layouts.find((l) => l.id === chosen.current?.id) ?? dashboard : dashboard;
        const to = next ?? dashboardPath(at);
        if (Object.keys(changes).length > 0) window.location.assign(to);
        else router.push(to);
        return;
      }
      if (saved) {
        // Done sends the screen's own settings, and the dashboard it shows
        // and its switches (#1282) when they changed; Cancel sends nothing.
        const changes = changedSettings(original.current, host.settings);
        const plan: ScreenPlan = { dashboardId: host.dashboardId, switches: host.switches };
        const planChanged = !samePlan(originalPlan.current, plan);
        if (Object.keys(changes).length > 0 || planChanged) {
          const res = await fetch(`/api/displays/${screen.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...(Object.keys(changes).length > 0 ? { settings: changes } : {}), ...(planChanged ? plan : {}) }),
          }).catch(() => null);
          if (!res?.ok) {
            setProblem(`The dashboard is saved, but ${screen.name}'s own settings did not reach it. Try again.`);
            finishing.current = false;
            setSaving(false);
            return;
          }
        }
      }
      if (ownScreenId() === screen.id) {
        // This browser is the screen: its settings now, then its dashboard,
        // loaded afresh so they all apply.
        if (saved) await syncScreenSettings().catch(() => null);
        const at = saved ? layouts.find((l) => l.id === chosen.current?.id) ?? startedOn.current : startedOn.current;
        window.location.assign(next ?? dashboardPath(at));
        return;
      }
      await markEditing(screen.id, false);
      router.push(next ?? (saved ? `${LIST}&edited=${screen.id}` : LIST));
    } catch {
      finishing.current = false;
      setSaving(false);
    }
  }, [screen, dashboard, host, layouts, router]);
  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; }, [finish]);

  // Once the screen (or dashboard) and the dashboards are known: the host the
  // frame looks for, and which dashboard the frame opens on. Set once, so the
  // frame is not reloaded under someone editing.
  const ready = screenId ? screen !== null : dashboard !== undefined && displays !== null;
  useEffect(() => {
    if (!ready || layoutsLoading || host || !rootRef.current) return;
    // A screen's settings as it has them; with no screen, this device's own (#1341).
    const settings = screen ? { ...screen.settings } : readLocalSettings();
    original.current = { ...settings };
    const plan: ScreenPlan = { dashboardId: screen?.dashboardId ?? null, switches: [...(screen?.switches ?? [])] };
    originalPlan.current = { ...plan, switches: [...plan.switches] };
    const next: RemoteEditHost = {
      displayId: screen?.id ?? null,
      ...plan,
      settings,
      settingsUpdatedAt: null,
      root: rootRef.current,
      canvasAbove: aboveRef.current,
      canvasBelow: belowRef.current,
      onDashboard: (layoutId, isDefault) => { chosen.current = { id: layoutId, isDefault }; },
      onFinish: (saved) => { void finishRef.current(saved); },
      unsaved: () => Object.keys(changedSettings(original.current, next.settings)).length > 0
        || !samePlan(originalPlan.current, { dashboardId: next.dashboardId, switches: next.switches }),
      pending: () => ({
        keys: Object.keys(changedSettings(original.current, next.settings)),
        plan: !samePlan(originalPlan.current, { dashboardId: next.dashboardId, switches: next.switches }),
      }),
      // The heading says the new name at once.
      onRenamed: (name) => setDisplays((list) => list?.map((d) => (d.id === next.displayId ? { ...d, name } : d)) ?? list),
    };
    (window as unknown as Record<string, unknown>)[REMOTE_EDIT_GLOBAL] = next;
    // A screen opens on the dashboard Edit was pressed on, or else on what
    // it shows now at set times (bus time is the screen's own to know).
    const exists = (id: string) => layouts.some((l) => l.id === id);
    const nowId = startDashboardId && exists(startDashboardId)
      ? startDashboardId
      : screen ? screenDashboardAt(plan, Date.now(), householdTimezone, [], exists) : null;
    const home = screen ? layouts.find((l) => l.id === nowId) ?? layouts.find((l) => l.isDefault) : dashboard;
    startedOn.current = home;
    const query = screen ? `?edit=1&screen=${encodeURIComponent(screen.id)}` : '?edit=1';
    setSrc(home && !(screen && home.isDefault) && home.slug ? `/d/${home.slug}${query}` : `/${query}`);
    setHost(next);
  }, [ready, screen, dashboard, layouts, layoutsLoading, host, householdTimezone, startDashboardId]);

  useEffect(() => () => {
    delete (window as unknown as Record<string, unknown>)[REMOTE_EDIT_GLOBAL];
  }, []);

  // A screen says it is being edited while this page is open; not to itself.
  useEffect(() => {
    const id = host?.displayId;
    if (!id || ownScreenId() === id) return;
    void markEditing(id, true);
    const timer = setInterval(() => void markEditing(id, true), RENEW_MS);
    const leave = () => { if (!finishing.current) void markEditing(id, false, true); };
    window.addEventListener('pagehide', leave);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [host]);

  // The room the picture has: beside the panels, all of its box; above them,
  // the page's width and part of its height.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const side = window.matchMedia(SIDE_BY_SIDE);
    const measure = () => {
      const r = el.getBoundingClientRect();
      // The caption under the picture keeps its line in the box (#1348).
      setRoom({ width: r.width, height: side.matches ? Math.max(0, r.height - CAPTION_ROOM) : window.innerHeight * PICTURE_MAX_HEIGHT });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    side.addEventListener('change', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); side.removeEventListener('change', measure); };
  }, [ready]);

  const scale = useMemo(() => {
    if (!room.width || !room.height) return 0;
    return Math.min(room.width / size.width, room.height / size.height);
  }, [room, size.width, size.height]);
  const shown = { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };

  // The screen itself goes back to what it shows; another device to the list.
  const back = self ? '/' : screenId ? LIST : dashboardPath(dashboard);
  const backLabel = screenId && !self ? 'Screens' : 'Dashboard';
  if (allowed === false) {
    return (
      <Page back={back} backLabel={backLabel}>
        <p className="text-body text-muted-foreground">Only a parent can edit {screenId ? 'a screen' : 'a dashboard'}.</p>
      </Page>
    );
  }
  if (missing) {
    return (
      <Page back={back} backLabel={backLabel}>
        <p className="text-body text-muted-foreground">
          {screenId ? 'That screen is no longer named. It may have been removed.' : 'That dashboard is gone. It may have been deleted.'}
        </p>
      </Page>
    );
  }

  const title = screen ? `Editing ${screen.name}` : dashboard ? `Editing ${dashboard.name}` : 'Editing';
  const groups: Array<[SizeChoice['group'], string]> = [['shows', 'Screens that show it'], ['size', 'Sizes'], ['other', 'Other screens']];
  return (
    <main
      className="min-h-dvh bg-background text-foreground lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_min(30rem,36vw)] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden"
      data-canvas-editor
    >
      <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] lg:col-start-1 lg:row-start-1 lg:px-6">
        <BackLink href={back} label={backLabel} />
        <h1 className="m-0 mb-1 text-title font-medium" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
        {narrow && (screen ?? dashboard) && (
          <p className="m-0 mb-1 text-caption text-muted-foreground" data-editing-not-this-phone>
            You are editing {(screen ?? dashboard)!.name}, not this phone.
          </p>
        )}
        {screen && (
          <p className="m-0 mb-3 text-caption text-muted-foreground" data-remote-status>
            {screen.online ? 'On now' : `Off. ${screen.name} shows the changes when it is next switched on`}
            {' · '}
            {screen.width && screen.height
              ? sizeText(size)
              : `shown at ${sizeText(size)} until it reports its size`}
          </p>
        )}
        {!screenId && choices.length > 0 && (
          <label className="mb-3 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
            Shown at
            <select
              className="min-h-[44px] rounded-lg border border-border bg-background px-2 text-body text-foreground"
              value={picked?.key ?? firstChoice}
              onChange={(e) => setChoice(e.target.value)}
              data-canvas-size
            >
              {groups.map(([group, label]) => {
                const inGroup = choices.filter((c) => c.group === group);
                if (inGroup.length === 0) return null;
                return (
                  <optgroup key={group} label={label}>
                    {inGroup.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </label>
        )}
        {problem && (
          <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 text-body text-destructive">
            {problem}
            <button type="button" className="min-h-[44px] rounded-full border border-border px-4 text-foreground" onClick={() => void finish(true)}>
              Try again
            </button>
          </div>
        )}
      </header>
      <div className="px-4 lg:col-start-1 lg:row-start-2 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden lg:px-6 lg:pb-6">
        {/* The frame draws the canvas's toggles here, In use | Idle and Day | Night (#1348). */}
        <div ref={aboveRef} className="shrink-0" data-canvas-above />
        <div ref={boxRef} className="flex w-full flex-col items-center lg:min-h-0 lg:flex-1" data-canvas-room>
          {src && scale > 0 && (
            <div
              className="relative shrink-0 overflow-hidden rounded-xl bg-black shadow-xl ring-1 ring-border"
              style={{ width: shown.width, height: shown.height }}
              data-remote-picture
            >
              <iframe
                title={`${screen?.name ?? dashboard?.name ?? 'Dashboard'}, live`}
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
          {/* And what it draws, under it. */}
          <div ref={belowRef} className="w-full shrink-0" style={shown.width ? { maxWidth: shown.width } : undefined} data-canvas-below />
        </div>
      </div>
      {/* The frame draws its editing panels and dialogs here. */}
      <div
        ref={rootRef}
        data-remote-edit-root
        className="px-4 pb-10 pt-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0 lg:border-l lg:border-border lg:p-4"
      />
    </main>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-1 inline-flex min-h-[44px] items-center gap-1 text-body text-muted-foreground hover:text-foreground">
      <ChevronLeft className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}

function Page({ back, backLabel, children }: { back: string; backLabel: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-background px-4 pb-40 pt-[max(1rem,env(safe-area-inset-top))] text-foreground">
      <BackLink href={back} label={backLabel} />
      <h1 className="m-0 mb-1 text-title font-medium" style={{ fontFamily: 'var(--font-display)' }}>Editing</h1>
      {children}
    </main>
  );
}
