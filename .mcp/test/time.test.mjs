// Time conversion for the MCP tools. Every case names its zone, so the result
// does not depend on the zone the test process runs in.
// Run after `npm run build`: node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TimeInputError,
  eventTimes,
  parseInstant,
  rangeBound,
  startOfWeekKey,
  todayKey,
  withLocalTimes,
} from '../dist/time.js';

const CHI = 'America/Chicago';

test('a wall time is read in the household zone', () => {
  assert.equal(parseInstant('2026-10-04T15:00', CHI, 'x').toISOString(), '2026-10-04T20:00:00.000Z');
  assert.equal(parseInstant('2026-12-04T15:00:00', CHI, 'x').toISOString(), '2026-12-04T21:00:00.000Z');
  assert.equal(parseInstant('2026-10-04T15:00', 'Asia/Tokyo', 'x').toISOString(), '2026-10-04T06:00:00.000Z');
});

test('a wall time in the spring-forward gap moves forward by the gap', () => {
  // 02:30 does not exist in Chicago on 2026-03-08; it becomes 03:30 CDT.
  assert.equal(parseInstant('2026-03-08T02:30', CHI, 'x').toISOString(), '2026-03-08T08:30:00.000Z');
});

test('a repeated wall time on the fall-back day takes its first occurrence', () => {
  // 01:30 happens twice in Chicago on 2026-11-01; the first is CDT (UTC-5).
  assert.equal(parseInstant('2026-11-01T01:30', CHI, 'x').toISOString(), '2026-11-01T06:30:00.000Z');
  // Either side of the change uses its own offset.
  assert.equal(parseInstant('2026-10-31T15:00', CHI, 'x').toISOString(), '2026-10-31T20:00:00.000Z');
  assert.equal(parseInstant('2026-11-01T15:00', CHI, 'x').toISOString(), '2026-11-01T21:00:00.000Z');
});

test('an explicit offset or Z is taken as written, whatever the household zone', () => {
  assert.equal(parseInstant('2026-10-04T15:00:00-05:00', 'Asia/Tokyo', 'x').toISOString(), '2026-10-04T20:00:00.000Z');
  assert.equal(parseInstant('2026-10-04T15:00:00+0900', CHI, 'x').toISOString(), '2026-10-04T06:00:00.000Z');
  assert.equal(parseInstant('2026-10-04T20:00:00.000Z', null, 'x').toISOString(), '2026-10-04T20:00:00.000Z');
});

test('a wall time without a known zone is refused, not guessed', () => {
  assert.throws(() => parseInstant('2026-10-04T15:00', null, 'startTime'), TimeInputError);
  assert.throws(() => parseInstant('tomorrow at 3', CHI, 'startTime'), TimeInputError);
  assert.throws(() => parseInstant('2026-10-04T25:00', CHI, 'startTime'), TimeInputError);
});

test('a date range bound covers the whole household day, 25 hours on fall-back day', () => {
  assert.equal(rangeBound('2026-11-01', CHI, 'start', 'x'), '2026-11-01T05:00:00.000Z');
  assert.equal(rangeBound('2026-11-01', CHI, 'end', 'x'), '2026-11-02T05:59:59.999Z');
  assert.equal(rangeBound('2026-03-08', CHI, 'end', 'x'), '2026-03-09T04:59:59.999Z');
  assert.equal(rangeBound('2026-10-04T15:00', CHI, 'start', 'x'), '2026-10-04T20:00:00.000Z');
  assert.throws(() => rangeBound('2026-02-30', CHI, 'start', 'x'), TimeInputError);
});

test('all-day dates go out floating, with an inclusive last day', () => {
  assert.deepEqual(eventTimes({ startTime: '2026-10-04', endTime: '2026-10-06', allDay: true }, CHI), {
    startTime: '2026-10-04T00:00:00.000Z',
    endTime: '2026-10-07T00:00:00.000Z',
  });
  // No end: one day. Floating, so no zone is needed.
  assert.deepEqual(eventTimes({ startTime: '2026-11-01', allDay: true }, null, true), {
    startTime: '2026-11-01T00:00:00.000Z',
    endTime: '2026-11-02T00:00:00.000Z',
  });
  // An update that moves only the start leaves the stored end to the server.
  assert.deepEqual(eventTimes({ startTime: '2026-11-01', allDay: true }, null), {
    startTime: '2026-11-01T00:00:00.000Z',
  });
});

test('a timed event refuses a bare date', () => {
  assert.throws(() => eventTimes({ startTime: '2026-10-04', endTime: '2026-10-04T10:00', allDay: false }, CHI), TimeInputError);
  assert.deepEqual(eventTimes({ startTime: '2026-10-04T09:00', endTime: '2026-10-04T10:00', allDay: false }, CHI), {
    startTime: '2026-10-04T14:00:00.000Z',
    endTime: '2026-10-04T15:00:00.000Z',
  });
});

test('events come back with household-local times', () => {
  const timed = withLocalTimes({ startTime: '2026-10-04T20:00:00.000Z', endTime: '2026-10-04T21:30:00.000Z', allDay: false }, CHI);
  assert.equal(timed.localStart, '2026-10-04T15:00');
  assert.equal(timed.localEnd, '2026-10-04T16:30');

  // A floating all-day range reads as its dates in every zone, last day inclusive.
  const allDay = withLocalTimes({ startTime: '2026-10-04T00:00:00.000Z', endTime: '2026-10-07T00:00:00.000Z', allDay: true }, 'Pacific/Kiritimati');
  assert.equal(allDay.localStart, '2026-10-04');
  assert.equal(allDay.localEnd, '2026-10-06');
});

test('today and week start are household dates', () => {
  // 03:30 UTC on 1 Oct is the evening of 30 Sep in Chicago.
  assert.equal(todayKey(CHI, new Date('2026-10-01T03:30:00Z')), '2026-09-30');
  assert.equal(todayKey('Asia/Tokyo', new Date('2026-10-01T03:30:00Z')), '2026-10-01');
  // 2026-10-01 is a Thursday.
  assert.equal(startOfWeekKey('2026-10-01', 0), '2026-09-27');
  assert.equal(startOfWeekKey('2026-10-01', 1), '2026-09-28');
});
