/**
 * @jest-environment node
 */
jest.mock('@/lib/db/client', () => ({ db: {} }));

import { matchRoute, mergeVehicle } from '../bus-live-ingest';
import { isValidRetention } from '../bus-live-retention';
import { liveVehiclePayloadSchema } from '@/lib/validations/liveVehicle';

const route = (id: string, liveMatch: unknown, enabled = true) =>
  ({ id, enabled, liveMatch }) as Parameters<typeof matchRoute>[2][number];

describe('matchRoute', () => {
  const routes = [
    route('am', { provider: 'p', label: 'Route 7', direction: 'AM' }),
    route('pm', { provider: 'p', label: 'Route 7', direction: 'PM' }),
    route('off', { provider: 'p', label: 'Route 9' }, false),
    route('any', { provider: 'q' }),
  ];

  it('matches on provider, label and direction', () => {
    expect(matchRoute('p', { label: 'Route 7', direction: 'AM' }, routes)).toBe('am');
    expect(matchRoute('p', { label: 'Route 7', direction: 'PM' }, routes)).toBe('pm');
  });

  it('ignores disabled routes and other providers', () => {
    expect(matchRoute('p', { label: 'Route 9', direction: 'AM' }, routes)).toBeNull();
    expect(matchRoute('p', { label: 'Route 8', direction: 'AM' }, routes)).toBeNull();
  });

  it('a binding without label or direction takes any track from that provider', () => {
    expect(matchRoute('q', { label: 'anything', direction: 'PM' }, routes)).toBe('any');
  });

  it('an unbound route never matches', () => {
    expect(matchRoute('p', { label: 'Route 7' }, [route('x', null)])).toBeNull();
  });
});

describe('mergeVehicle', () => {
  it('keeps the previous report when none arrives', () => {
    expect(mergeVehicle({ number: '14' }, undefined)).toEqual({ number: '14' });
    expect(mergeVehicle(null, undefined)).toBeNull();
  });

  it('takes the latest report, unflagged when nothing changed', () => {
    expect(mergeVehicle({ number: '14', driverName: 'A' }, { number: '14', driverName: 'A' }))
      .toEqual({ number: '14', driverName: 'A', changedMidDay: false });
  });

  it('flags a driver or vehicle change during the day, and the flag sticks', () => {
    const swapped = mergeVehicle({ number: '14', driverName: 'A' }, { number: '14', driverName: 'B' });
    expect(swapped).toMatchObject({ driverName: 'B', changedMidDay: true });
    expect(mergeVehicle(swapped, { number: '14', driverName: 'B' })).toMatchObject({ changedMidDay: true });
    expect(mergeVehicle({ number: '14' }, { number: '22' })).toMatchObject({ changedMidDay: true });
  });

  it('a field appearing for the first time is not a change', () => {
    expect(mergeVehicle({ number: '14' }, { number: '14', driverName: 'A' }))
      .toMatchObject({ changedMidDay: false });
  });
});

describe('isValidRetention', () => {
  it('accepts whole days inside the limits only', () => {
    expect(isValidRetention('trace', 30)).toBe(true);
    expect(isValidRetention('trace', 0)).toBe(false);
    expect(isValidRetention('trace', 366)).toBe(false);
    expect(isValidRetention('trace', 1.5)).toBe(false);
    expect(isValidRetention('trace', '30')).toBe(false);
    expect(isValidRetention('history', 1825)).toBe(true);
    expect(isValidRetention('history', 1826)).toBe(false);
  });
});

describe('liveVehiclePayloadSchema', () => {
  const fix = { track: 't1', ts: '2026-03-02T13:05:00Z', lat: 39.7, lng: -104.9 };

  it('accepts a minimal fix and a full track', () => {
    expect(liveVehiclePayloadSchema.safeParse({ provider: 'p', fixes: [fix] }).success).toBe(true);
    expect(liveVehiclePayloadSchema.safeParse({
      provider: 'p',
      tracks: [{
        key: 't1', date: '2026-03-02', direction: 'AM', label: 'Route 7',
        vehicle: { number: '14', driverName: 'Sam Example' },
        stops: [{ key: 's1', order: 0, lat: 39.7, lng: -104.9, plannedAt: '2026-03-02T13:10:00-07:00', kind: 'stop' }],
      }],
    }).success).toBe(true);
  });

  it('rejects impossible coordinates, times without a zone and unknown kinds', () => {
    expect(liveVehiclePayloadSchema.safeParse({ provider: 'p', fixes: [{ ...fix, lat: 91 }] }).success).toBe(false);
    expect(liveVehiclePayloadSchema.safeParse({ provider: 'p', fixes: [{ ...fix, ts: '2026-03-02 13:05' }] }).success).toBe(false);
    expect(liveVehiclePayloadSchema.safeParse({
      provider: 'p', stopEvents: [{ track: 't1', stop: 's1', kind: 'passed', at: fix.ts }],
    }).success).toBe(false);
  });

  it('requires a provider', () => {
    expect(liveVehiclePayloadSchema.safeParse({ fixes: [fix] }).success).toBe(false);
  });
});
