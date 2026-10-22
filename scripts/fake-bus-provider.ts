/**
 * A fake live bus provider. Plays one made-up morning trip into Prism's live
 * ingest endpoint, the same way a real provider would: today's track first,
 * then a fix every few seconds, stop arrivals and departures, and progress.
 *
 * It is also the reference for the contract in src/lib/validations/liveVehicle.ts:
 * a new provider only has to send what this script sends.
 *
 *   PRISM_URL=http://localhost:3000 PRISM_INGEST_TOKEN=<bus:ingest token> \
 *     npx tsx scripts/fake-bus-provider.ts [--speed 10] [--label "Route 7"]
 *
 * --speed plays the trip faster than real time (fix times stay real, so the
 * stored trace still reads as a normal trip). The route, stops, vehicle and
 * driver are invented; the coordinates are a few streets in central Denver.
 */

interface Stop { key: string; name: string; lat: number; lng: number; kind: 'stop' | 'school'; rider?: boolean }

const STOPS: Stop[] = [
  { key: 's1', name: 'Maple & 1st', lat: 39.7392, lng: -104.9903, kind: 'stop' },
  { key: 's2', name: 'Cedar Ct', lat: 39.7392, lng: -104.9800, kind: 'stop' },
  { key: 's3', name: 'Willow Ln', lat: 39.7460, lng: -104.9800, kind: 'stop', rider: true },
  { key: 's4', name: 'Aspen Way', lat: 39.7460, lng: -104.9700, kind: 'stop' },
  { key: 'school', name: 'Example Elementary', lat: 39.7530, lng: -104.9700, kind: 'school' },
];

// A railroad crossing between the third and fourth stops: the door opens
// there by law, which must not be read as a stop.
const CROSSING = { lat: 39.7460, lng: -104.9750 };

const SPEED_MPS = 9;        // ~32 km/h
const DWELL_S = 30;
const CROSSING_DWELL_S = 12;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const url = process.env.PRISM_URL ?? 'http://localhost:3000';
const token = process.env.PRISM_INGEST_TOKEN;
const speedup = Number(arg('speed', '1'));
const label = arg('label', 'Route 7');
if (!token) {
  console.error('Set PRISM_INGEST_TOKEN to a token with the bus:ingest scope.');
  process.exit(1);
}

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = b.lat - a.lat;
  const dLng = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180);
  return (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
}

type Step =
  | { kind: 'drive'; from: { lat: number; lng: number }; to: { lat: number; lng: number } }
  | { kind: 'dwell'; at: { lat: number; lng: number }; seconds: number; stop?: Stop };

function plan(): Step[] {
  const steps: Step[] = [];
  for (let i = 0; i < STOPS.length; i++) {
    const stop = STOPS[i]!;
    if (i > 0) {
      const prev = STOPS[i - 1]!;
      if (i === 3) {
        steps.push({ kind: 'drive', from: prev, to: CROSSING });
        steps.push({ kind: 'dwell', at: CROSSING, seconds: CROSSING_DWELL_S });
        steps.push({ kind: 'drive', from: CROSSING, to: stop });
      } else {
        steps.push({ kind: 'drive', from: prev, to: stop });
      }
    }
    steps.push({ kind: 'dwell', at: stop, seconds: stop.kind === 'school' ? 60 : DWELL_S, stop });
  }
  return steps;
}

async function post(body: unknown): Promise<void> {
  const res = await fetch(`${url}/api/bus-tracking/live/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ingest ${res.status}: ${text}`);
  console.log(text);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms / speedup));

async function main() {
  const provider = 'fake-provider';
  const trackKey = `fake-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const steps = plan();
  const actualSeconds = steps.reduce((sum, step) =>
    sum + (step.kind === 'drive' ? metres(step.from, step.to) / (SPEED_MPS * 0.85) : step.seconds), 0);
  // Played faster than real time, the trip starts in the past so that its
  // last fix lands at about now; otherwise later fixes would be stamped in
  // the future, and ingest drops those.
  const start = new Date(Date.now() - actualSeconds * 1000 * (1 - 1 / speedup));
  const date = start.toLocaleDateString('en-CA'); // YYYY-MM-DD in this machine's zone

  // Planned times: driving time between stops plus the dwells, as a schedule
  // would have them, then the trip runs a little slower than planned.
  const plannedAt = new Map<string, string>();
  let t = 0;
  for (const step of steps) {
    if (step.kind === 'drive') t += metres(step.from, step.to) / SPEED_MPS;
    else {
      if (step.stop) plannedAt.set(step.stop.key, new Date(start.getTime() + t * 1000).toISOString());
      t += step.seconds;
    }
  }

  await post({
    provider,
    tracks: [{
      key: trackKey,
      date,
      direction: 'AM',
      label,
      plannedStart: start.toISOString(),
      plannedEnd: new Date(start.getTime() + t * 1000).toISOString(),
      status: 'live',
      vehicle: { number: '14', color: 'Yellow', model: 'Example 72', driverName: 'Sam Example' },
      stops: STOPS.map((s, order) => ({ ...s, order, plannedAt: plannedAt.get(s.key) })),
    }],
  });

  let clock = start.getTime();
  let n = 0;
  let visited = 0;
  const fix = (p: { lat: number; lng: number }, heading: number, speed: number, doorOpen: boolean) => ({
    track: trackKey,
    eventId: `fake-${start.getTime()}-${n++}`,
    ts: new Date(clock).toISOString(),
    lat: p.lat, lng: p.lng, heading, speed,
    moving: speed > 0, doorOpen, ignition: true,
  });
  // Real feeds are irregular: mostly ~10s, sometimes 1 to 4s, sometimes 20s+.
  const gap = () => (Math.random() < 0.2 ? 1 + Math.random() * 3 : 6 + Math.random() * 16);

  let heading = 90;
  for (const step of steps) {
    if (step.kind === 'drive') {
      heading = bearing(step.from, step.to);
      const total = metres(step.from, step.to) / (SPEED_MPS * 0.85);
      for (let s = 0; s < total;) {
        const dt = Math.min(gap(), total - s);
        s += dt; clock += dt * 1000;
        const f = s / total;
        const p = { lat: step.from.lat + (step.to.lat - step.from.lat) * f, lng: step.from.lng + (step.to.lng - step.from.lng) * f };
        await sleep(dt * 1000);
        await post({ provider, fixes: [fix(p, heading, SPEED_MPS * 0.85, false)] });
      }
    } else {
      if (step.stop) {
        await post({ provider, stopEvents: [{ track: trackKey, stop: step.stop.key, kind: 'arrived', at: new Date(clock).toISOString() }] });
      }
      await post({ provider, fixes: [fix(step.at, heading, 0, true)] });
      await sleep(step.seconds * 1000); clock += step.seconds * 1000;
      await post({ provider, fixes: [fix(step.at, heading, 0, false)] });
      if (step.stop) {
        visited++;
        await post({
          provider,
          stopEvents: [{ track: trackKey, stop: step.stop.key, kind: 'departed', at: new Date(clock).toISOString() }],
          progress: [{ track: trackKey, lastVisitedStop: visited, totalStops: STOPS.length }],
        });
      }
    }
  }
  await post({ provider, tracks: [{ key: trackKey, date, status: 'completed' }] });
  console.log('Trip complete.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
