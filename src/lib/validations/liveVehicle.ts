import { z } from 'zod';

/**
 * The live vehicle position contract. Any provider (a sidecar, an adapter, a
 * GPS tracker bridge) sends this shape to POST /api/bus-tracking/live/ingest.
 * Nothing here is specific to one vendor: keys are opaque strings chosen by
 * the provider, stable for the day, and Prism never needs to know what they
 * stand for.
 *
 * A payload can carry any mix of the four parts. A provider normally sends the
 * tracks (what is running today) once in the morning and again when they
 * change, then a fix per position update. Fixes and stop events name their
 * track by key, so a track must have been sent first, in this payload or an
 * earlier one the same day.
 */

const isoTime = z.string().datetime({ offset: true });
const key = z.string().min(1).max(128);
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const liveStopSchema = z.object({
  key,
  name: z.string().max(255).optional(),
  order: z.number().int().min(0).max(1000),
  lat,
  lng,
  plannedAt: isoTime.optional(),
  kind: z.enum(['stop', 'school', 'depot']).optional(),
  // The rider's stop, the one the widget gives an arrival time for.
  // Without it, the stop whose name matches the route's stop name is used.
  rider: z.boolean().optional(),
});

export const liveTrackSchema = z.object({
  key,
  // The trip's date in the household's calendar.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  direction: z.enum(['AM', 'PM']).optional(),
  label: z.string().max(100).optional(),
  plannedStart: isoTime.optional(),
  plannedEnd: isoTime.optional(),
  status: z.string().max(30).optional(),
  vehicle: z.object({
    number: z.string().max(50).optional(),
    plate: z.string().max(50).optional(),
    color: z.string().max(50).optional(),
    model: z.string().max(100).optional(),
    driverName: z.string().max(100).optional(),
    substitute: z.boolean().optional(),
  }).optional(),
  stops: z.array(liveStopSchema).max(200).optional(),
});

export const liveFixSchema = z.object({
  track: key,
  eventId: key.optional(),
  // When the vehicle was there. Fixes may arrive late or out of order.
  ts: isoTime,
  lat,
  lng,
  // Degrees clockwise from north.
  heading: z.number().min(0).max(360).optional(),
  // Metres per second.
  speed: z.number().min(0).max(100).optional(),
  moving: z.boolean().optional(),
  doorOpen: z.boolean().optional(),
  ignition: z.boolean().optional(),
});

export const liveStopEventSchema = z.object({
  track: key,
  stop: key,
  kind: z.enum(['arrived', 'departed']),
  at: isoTime,
});

export const liveProgressSchema = z.object({
  track: key,
  lastVisitedStop: z.number().int().min(0),
  totalStops: z.number().int().min(0),
});

export const liveVehiclePayloadSchema = z.object({
  provider: z.string().min(1).max(50),
  tracks: z.array(liveTrackSchema).max(20).optional(),
  fixes: z.array(liveFixSchema).max(1000).optional(),
  stopEvents: z.array(liveStopEventSchema).max(500).optional(),
  progress: z.array(liveProgressSchema).max(20).optional(),
});

export type LiveVehiclePayload = z.infer<typeof liveVehiclePayloadSchema>;
export type LiveTrackInput = z.infer<typeof liveTrackSchema>;
export type LiveFixInput = z.infer<typeof liveFixSchema>;
