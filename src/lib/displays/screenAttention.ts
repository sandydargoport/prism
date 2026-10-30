/**
 * Attention notices for a named screen (#692, phase 2): a short list of
 * things worth a glance right now, shown as notification cards in a panel at
 * the side of the screen, newest on top.
 *
 *  - The bus is within N minutes of the household's stop.
 *  - A calendar event starts within N minutes.
 *  - A family message was posted in the last N minutes.
 *
 * Stored as one of the screen's settings (see SCREEN_SETTING_KEYS), like the
 * time-of-day schedule. Unset, or every trigger off, shows nothing.
 */

export const SCREEN_ATTENTION_KEY = 'prism-screen-attention';

export type AttentionKind = 'bus' | 'event' | 'message';

/** Minutes for each trigger; null turns it off. */
export type AttentionSettings = Record<AttentionKind, number | null>;

export const ATTENTION_KINDS: AttentionKind[] = ['bus', 'event', 'message'];

export const ATTENTION_OFF: AttentionSettings = { bus: null, event: null, message: null };

/** What a trigger starts at when someone turns it on. */
export const ATTENTION_DEFAULTS: Record<AttentionKind, number> = { bus: 15, event: 15, message: 120 };

/** The range each trigger accepts, in minutes. */
export const ATTENTION_LIMITS: Record<AttentionKind, { min: number; max: number }> = {
  bus: { min: 1, max: 120 },
  event: { min: 1, max: 240 },
  message: { min: 5, max: 24 * 60 },
};

/** More cards than this and the oldest drop off. */
export const MAX_NOTICES = 4;

function cleanMinutes(kind: AttentionKind, raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const { min, max } = ATTENTION_LIMITS[kind];
  return Math.min(max, Math.max(min, Math.round(raw)));
}

export function parseAttention(raw: string | null | undefined): AttentionSettings {
  if (!raw) return { ...ATTENTION_OFF };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...ATTENTION_OFF };
    const r = parsed as Record<string, unknown>;
    return { bus: cleanMinutes('bus', r.bus), event: cleanMinutes('event', r.event), message: cleanMinutes('message', r.message) };
  } catch {
    return { ...ATTENTION_OFF };
  }
}

/** The value to store, or null to unset the setting when every trigger is off. */
export function serializeAttention(settings: AttentionSettings): string | null {
  const out: Partial<AttentionSettings> = {};
  for (const kind of ATTENTION_KINDS) {
    const minutes = cleanMinutes(kind, settings[kind]);
    if (minutes !== null) out[kind] = minutes;
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : null;
}

export type Notice = {
  /** Stable while the same thing needs attention, so a dismissal sticks. */
  id: string;
  kind: AttentionKind;
  /** When it started needing attention; newest is shown first. */
  since: number;
  title: string;
  /** The moment it is about (bus at the stop, event start, message posted). */
  at: number;
};

const MIN = 60 * 1000;

/** The live trip's numbers this needs (see LiveTrack). */
export type BusTrip = {
  id: string;
  routeId: string;
  routeLabel: string;
  riderStop: { name: string | null; projectedAt: string | null; passed: boolean } | null;
};

/** The emailed-checkpoint estimate, for routes with no live trip (see BusRouteStatus). */
export type BusEstimate = {
  id: string;
  label: string;
  stopName: string | null;
  etaMinutes: number | null;
};

/**
 * The bus is due at the household's stop within `minutes`. A live trip is
 * used where there is one; the emailed estimate covers routes without.
 */
export function busNotices(trips: BusTrip[], estimates: BusEstimate[], now: number, minutes: number): Notice[] {
  const out: Notice[] = [];
  const live = new Set<string>();
  for (const trip of trips) {
    live.add(trip.routeId);
    const stop = trip.riderStop;
    if (!stop || stop.passed || !stop.projectedAt) continue;
    const at = new Date(stop.projectedAt).getTime();
    if (!Number.isFinite(at) || at - now > minutes * MIN) continue;
    out.push({ id: `bus:${trip.id}`, kind: 'bus', since: at - minutes * MIN, title: trip.routeLabel, at });
  }
  for (const est of estimates) {
    if (live.has(est.id) || est.etaMinutes === null || est.etaMinutes > minutes) continue;
    // Whole minutes, so the card stays put between polls of a steady estimate.
    const at = Math.round((now + est.etaMinutes * MIN) / MIN) * MIN;
    out.push({ id: `bus:${est.id}`, kind: 'bus', since: at - minutes * MIN, title: est.label, at });
  }
  return out;
}

export type EventLike = { id: string; title: string; startTime: Date; allDay: boolean };

/** A timed event starts within `minutes`. It goes once it has started. */
export function eventNotices(events: EventLike[], now: number, minutes: number): Notice[] {
  const out: Notice[] = [];
  for (const e of events) {
    if (e.allDay) continue;
    const at = e.startTime.getTime();
    if (at <= now || at - now > minutes * MIN) continue;
    out.push({ id: `event:${e.id}:${at}`, kind: 'event', since: at - minutes * MIN, title: e.title, at });
  }
  return out;
}

export type MessageLike = { id: string; message: string; createdAt: Date; author: { name: string } };

/** A message posted in the last `minutes`. */
export function messageNotices(messages: MessageLike[], now: number, minutes: number): Notice[] {
  const out: Notice[] = [];
  for (const m of messages) {
    const at = m.createdAt.getTime();
    if (at > now || now - at >= minutes * MIN) continue;
    out.push({ id: `message:${m.id}`, kind: 'message', since: at, title: `${m.author.name}: ${m.message}`, at });
  }
  return out;
}

/** Newest first, without the dismissed ones, at most MAX_NOTICES. */
export function arrangeNotices(notices: Notice[], dismissed: ReadonlySet<string>): Notice[] {
  return notices
    .filter((n) => !dismissed.has(n.id))
    .sort((a, b) => b.since - a.since || a.id.localeCompare(b.id))
    .slice(0, MAX_NOTICES);
}
