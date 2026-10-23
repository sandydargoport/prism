/**
 * @jest-environment node
 */
jest.mock('@/lib/db/client', () => ({ db: {} }));

import { driverKey, summarizeTrip, weatherBucket, type TripFacts } from '../bus-history';
import { accuracyByHorizon, dueHorizons } from '../bus-eta-snapshots';
import type { LiveTrackStop } from '@/lib/db/schema';

const at = (hhmm: string) => new Date(`2026-03-02T${hhmm}:00Z`);
const stops: LiveTrackStop[] = [
  { key: 'a', order: 0, lat: 0, lng: 0 },
  { key: 'b', order: 1, lat: 0, lng: 0.01 },
  { key: 'c', order: 2, lat: 0, lng: 0.02 },
  { key: 'school', order: 3, lat: 0, lng: 0.03, kind: 'school' },
];
const facts = (over: Partial<TripFacts>): TripFacts =>
  ({ stops, visits: [], progress: null, fixes: [], firstMove: null, ...over });
const arrived = (...keys: string[]) => keys.map((stopKey, i) => ({ stopKey, arrivedAt: at(`13:0${i}`) }));

describe('summarizeTrip', () => {
  it('marks a reported trip that reached no stop as not run, not as one that took no time', () => {
    const s = summarizeTrip(facts({}));
    expect(s.outcome).toBe('none');
    expect(s.stopsVisited).toBe(0);
    expect(s.finishedAt).toBeNull();
  });

  it('tells a full trip from one cut short', () => {
    expect(summarizeTrip(facts({ visits: arrived('a', 'b', 'c', 'school') })).outcome).toBe('ran');
    expect(summarizeTrip(facts({ visits: arrived('a', 'b') })).outcome).toBe('partial');
    // The provider's count can run ahead of the arrival events.
    expect(summarizeTrip(facts({ visits: arrived('a'), progress: { lastVisitedStop: 4, totalStops: 4 } })).outcome).toBe('ran');
  });

  it('does not finish a trip on a count over the provider\'s whole route', () => {
    // 14 of 22 on the provider's route says nothing about our four stops.
    const s = summarizeTrip(facts({ visits: arrived('a'), progress: { lastVisitedStop: 14, totalStops: 22 } }));
    expect(s.outcome).toBe('partial');
    expect(s.stopsVisited).toBe(1);
  });

  it('times the trip from the first move to the last arrival', () => {
    const s = summarizeTrip(facts({ visits: arrived('a', 'b', 'c', 'school'), firstMove: at('12:50') }));
    expect(s.startedAt).toEqual(at('12:50'));
    expect(s.finishedAt).toEqual(at('13:03'));
  });

  it('counts stops passed without the doors opening near them', () => {
    const fixes = [
      { ts: at('13:00'), lat: 0, lng: 0, doorOpen: true },      // at a
      { ts: at('13:01'), lat: 0, lng: 0.005, doorOpen: true },  // between stops: a crossing
      { ts: at('13:02'), lat: 0, lng: 0.02, doorOpen: false },  // at c, doors shut
    ];
    const s = summarizeTrip(facts({ visits: arrived('a', 'b', 'c', 'school'), fixes }));
    expect(s.stopsSkipped).toBe(2); // b and c; the school is not a pick-up stop
  });

  it('leaves skipped stops unknown when the provider sends no door state', () => {
    const fixes = [{ ts: at('13:00'), lat: 0, lng: 0, doorOpen: null }];
    expect(summarizeTrip(facts({ visits: arrived('a'), fixes })).stopsSkipped).toBeNull();
  });
});

describe('weatherBucket', () => {
  it('groups conditions into dry, rain and snow', () => {
    expect(weatherBucket('snowy')).toBe('snow');
    expect(weatherBucket('stormy')).toBe('rain');
    expect(weatherBucket('rainy')).toBe('rain');
    expect(weatherBucket('cloudy')).toBe('dry');
    expect(weatherBucket(undefined)).toBeNull();
  });
});

describe('driverKey', () => {
  it('tells drivers apart without keeping the name', () => {
    const k = driverKey('Sam Example', 'secret')!;
    expect(k).toHaveLength(16);
    expect(k).not.toMatch(/sam|example/i);
    expect(driverKey(' sam example ', 'secret')).toBe(k);
    expect(driverKey('Alex Example', 'secret')).not.toBe(k);
    expect(driverKey('Sam Example', '')).toBeNull();
    expect(driverKey(null, 'secret')).toBeNull();
  });
});

describe('dueHorizons', () => {
  it('is due only in the minute before each lead time', () => {
    expect(dueHorizons(20 * 60_000)).toEqual([20]);
    expect(dueHorizons(19.5 * 60_000)).toEqual([20]);
    expect(dueHorizons(18 * 60_000)).toEqual([]);
    expect(dueHorizons(90_000)).toEqual([2]);
    expect(dueHorizons(30 * 60_000)).toEqual([]);
  });

  it('does not back-fill lead times a late feed missed', () => {
    expect(dueHorizons(7 * 60_000)).toEqual([]);
  });
});

describe('accuracyByHorizon', () => {
  const row = (horizonMin: number, predicted: string, actual: string | null) =>
    ({ horizonMin, predictedAt: at(predicted), actualAt: actual ? at(actual) : null });

  it('scores the miss each way and which way it leans', () => {
    const result = accuracyByHorizon([
      row(10, '13:10', '13:12'),
      row(10, '13:10', '13:11'),
      row(10, '13:10', '13:09'),
    ]);
    const ten = result.find((h) => h.horizonMin === 10)!;
    expect(ten.trips).toBe(3);
    expect(ten.typicalMin).toBe(1);
    expect(ten.biasMin).toBe(1); // the bus tends to come later than shown
  });

  it('skips a snapshot whose bus never reached the stop', () => {
    const result = accuracyByHorizon([row(5, '13:10', null), row(5, '13:10', '13:10')]);
    const five = result.find((h) => h.horizonMin === 5)!;
    expect(five.trips).toBe(1);
    expect(five.typicalMin).toBe(0);
    expect(result.find((h) => h.horizonMin === 20)!.trips).toBe(0);
  });
});
