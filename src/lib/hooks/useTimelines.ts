'use client';

/**
 * The household's timelines (#1266), one copy for the whole page.
 *
 * The dashboard, the editor and Settings all read the same list, so a change
 * made in one shows in the others at once. Changes are kept as they are made
 * (as a screen's own settings always were): each is shown straight away and
 * sent to the server; if the server refuses, the list is read again.
 *
 * The dashboard looks at the list again every minute, so a screen follows a
 * change made from another device without being reloaded.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';
import { remoteEditHost } from '@/lib/displays/remoteEdit';
import { loadBase, setBaseTimeline } from '@/lib/displays/displaySettingsSync';
import { timelineFor, type Timeline, type TimelinePatch } from '@/lib/timeline';

type State = { timelines: Timeline[]; loaded: boolean };

const EMPTY: State = { timelines: [], loaded: false };
let state: State = EMPTY;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function emit(next: State): void {
  state = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read the list again. Calls made while one is in flight share it. */
export function refreshTimelines(): Promise<void> {
  inflight ??= (async () => {
    try {
      const res = await fetch('/api/timelines', { cache: 'no-store' });
      const data = res.ok ? await res.json() : null;
      emit({ timelines: Array.isArray(data?.timelines) ? data.timelines : state.timelines, loaded: true });
    } catch {
      emit({ ...state, loaded: true });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

const POLL_MS = 60 * 1000;

export function useTimelines({ poll = false }: { poll?: boolean } = {}): State {
  const current = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  useEffect(() => {
    if (!state.loaded) void refreshTimelines();
  }, []);
  useVisibilityPolling(() => { if (poll) void refreshTimelines(); }, POLL_MS, { pollWhileIdle: true });
  return current;
}

async function send(url: string, init: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

/** Change a timeline; shown at once, kept on the server. False when refused. */
export async function patchTimeline(id: string, patch: TimelinePatch): Promise<boolean> {
  emit({ ...state, timelines: state.timelines.map((t) => (t.id === id ? { ...t, ...patch } as Timeline : t)) });
  const ok = await send(`/api/timelines/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  if (!ok) await refreshTimelines();
  return !!ok;
}

/** A new timeline, empty or a copy of another. Null when refused. */
export async function createTimeline(body: { name?: string; copyOf?: string }): Promise<Timeline | null> {
  const res = await send('/api/timelines', { method: 'POST', body: JSON.stringify(body) });
  const created = res ? ((await res.json()) as { timeline?: Timeline }).timeline ?? null : null;
  await refreshTimelines();
  return created;
}

export async function deleteTimeline(id: string): Promise<boolean> {
  const ok = await send(`/api/timelines/${id}`, { method: 'DELETE' });
  await refreshTimelines();
  return !!ok;
}

/**
 * A screen follows another timeline. When it is this page's own screen, or
 * the one the canvas editor is editing, this page follows it at once too.
 */
export async function pickTimeline(screenId: string, timelineId: string | null): Promise<boolean> {
  const ok = await send(`/api/displays/${screenId}`, { method: 'PATCH', body: JSON.stringify({ timelineId }) });
  if (ok) {
    const host = remoteEditHost();
    if (host) {
      if (host.displayId === screenId) host.timelineId = timelineId;
    } else if (loadBase()?.displayId === screenId) {
      setBaseTimeline(timelineId);
    }
  }
  // The counts of screens on each changed.
  await refreshTimelines();
  return !!ok;
}

/**
 * The timeline this page follows, by id; null is the household's first. A
 * named screen follows its own; the frame of the canvas editor follows the
 * screen being edited; any other device follows the first.
 */
export function deviceTimelineId(): string | null {
  if (typeof window === 'undefined') return null;
  const host = remoteEditHost();
  if (host) return host.displayId ? host.timelineId ?? null : null;
  return loadBase()?.timelineId ?? null;
}

/** The named screen this page is, or edits: its id, or null. */
export function deviceScreenId(): string | null {
  if (typeof window === 'undefined') return null;
  const host = remoteEditHost();
  if (host) return host.displayId;
  return loadBase()?.displayId ?? null;
}

/** The timeline this page follows (see deviceTimelineId), once the list is in. */
export function useDeviceTimeline(options?: { poll?: boolean }): { timeline: Timeline | null; timelines: Timeline[]; loaded: boolean } {
  const { timelines, loaded } = useTimelines(options);
  return { timeline: timelineFor(timelines, deviceTimelineId()), timelines, loaded };
}
