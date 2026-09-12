import { patchEventSchema, createEventSchema } from '@/lib/validations';

/**
 * PATCH /api/events/[id] validated nothing at all: `updateEventSchema` was
 * written and never imported, so description and location reached the database
 * with no length bound, and an emptied field had no way to say "clear this".
 *
 * These pin both halves of the contract the route now depends on.
 */
describe('patchEventSchema', () => {
  it('accepts a body that changes one field and says nothing about the rest', () => {
    expect(patchEventSchema.safeParse({ title: 'Renamed' }).success).toBe(true);
    expect(patchEventSchema.safeParse({}).success).toBe(true);
  });

  it('accepts null as "clear this field"', () => {
    // The route reads `'description' in body`, so a cleared field has to travel
    // as an explicit null. Undefined is dropped by JSON.stringify and reads as
    // "leave it alone".
    for (const key of ['description', 'location', 'recurrenceRule', 'color', 'reminderMinutes', 'calendarSourceId']) {
      const result = patchEventSchema.safeParse({ [key]: null });
      expect([key, result.success]).toEqual([key, true]);
    }
  });

  it('bounds the text fields, which PATCH never did', () => {
    expect(patchEventSchema.safeParse({ description: 'x'.repeat(5000) }).success).toBe(true);
    expect(patchEventSchema.safeParse({ description: 'x'.repeat(5001) }).success).toBe(false);
    expect(patchEventSchema.safeParse({ location: 'x'.repeat(5000) }).success).toBe(true);
    expect(patchEventSchema.safeParse({ location: 'x'.repeat(5001) }).success).toBe(false);
    expect(patchEventSchema.safeParse({ title: '' }).success).toBe(false);
  });

  // A synced calendar writes location unbounded (the column is `text` and sync
  // does not use this schema), so a bound that real venue blocks exceed makes
  // those events uneditable: the form sends the stored value back unchanged and
  // PATCH refuses it. A 335-character location did exactly that.
  it('accepts a venue block long enough to come back from a real calendar', () => {
    const venue = 'Northfield Community Playhouse, 1200 Example Parkway, Suite 400, '
      + 'Springfield, IL 60000. Parking behind the building off Example Lane; '
      + 'accessible entrance on the north side. Doors open 30 minutes before curtain. '
      + 'Late seating at the usher\'s discretion during a scene break. Box office '
      + 'opens one hour prior on performance days; will-call under the booking name.';
    expect(venue.length).toBeGreaterThan(300);
    expect(patchEventSchema.safeParse({ location: venue }).success).toBe(true);
  });

  it('still rejects malformed values', () => {
    expect(patchEventSchema.safeParse({ color: 'red' }).success).toBe(false);
    expect(patchEventSchema.safeParse({ calendarSourceId: 'not-a-uuid' }).success).toBe(false);
    expect(patchEventSchema.safeParse({ reminderMinutes: 99999 }).success).toBe(false);
  });

  it('leaves create alone: there is nothing to clear on a new event', () => {
    const base = {
      title: 'New',
      startTime: '2026-01-01T10:00:00.000Z',
      endTime: '2026-01-01T11:00:00.000Z',
    };
    expect(createEventSchema.safeParse(base).success).toBe(true);
    expect(createEventSchema.safeParse({ ...base, description: null }).success).toBe(false);
  });
});
