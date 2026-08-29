/**
 * The policy that decides whether vanished tasks are flagged for review.
 *
 * These are the cases that matter: an ordinary tick-off must reach the user,
 * and a provider outage must not.
 */
import {
  decideDeletionReview,
  MASS_DELETE_MAX_ITEMS,
  MASS_DELETE_FRACTION,
} from '../taskDeletionReview';

describe('decideDeletionReview — ordinary loss', () => {
  it('does nothing when nothing went missing', () => {
    expect(decideDeletionReview({ syncedCount: 20, missingCount: 0 })).toEqual({
      flag: false,
      guardTripped: false,
      withheld: 0,
    });
  });

  it('flags a single disappearance, the everyday case', () => {
    // Someone ticked a task off on their phone. This must always reach the
    // user, including when it is the only task in the list.
    expect(decideDeletionReview({ syncedCount: 1, missingCount: 1 }).flag).toBe(true);
    expect(decideDeletionReview({ syncedCount: 40, missingCount: 1 }).flag).toBe(true);
  });

  it('flags a handful without tripping the guard', () => {
    const d = decideDeletionReview({ syncedCount: 40, missingCount: 5 });
    expect(d).toEqual({ flag: true, guardTripped: false, withheld: 0 });
  });

  it('flags right up to the item limit', () => {
    const d = decideDeletionReview({ syncedCount: 100, missingCount: MASS_DELETE_MAX_ITEMS });
    expect(d.flag).toBe(true);
    expect(d.guardTripped).toBe(false);
  });
});

describe('decideDeletionReview — bulk loss is withheld', () => {
  it('withholds one past the item limit', () => {
    const d = decideDeletionReview({ syncedCount: 100, missingCount: MASS_DELETE_MAX_ITEMS + 1 });
    expect(d).toEqual({ flag: false, guardTripped: true, withheld: 11 });
  });

  it('withholds when the provider returns an empty list', () => {
    // The failure this exists for: an outage or revoked scope, which used to
    // delete every synced task locally with no undo.
    const d = decideDeletionReview({ syncedCount: 200, missingCount: 200 });
    expect(d.flag).toBe(false);
    expect(d.withheld).toBe(200);
  });

  it('withholds on fraction even when under the item limit', () => {
    // 4 of 8 is half the set — well under 10 items, but a proportion that
    // looks like breakage rather than housekeeping.
    const d = decideDeletionReview({ syncedCount: 8, missingCount: 4 });
    expect(d.guardTripped).toBe(true);
  });

  it('never trips on a single loss, whatever the fraction', () => {
    // 1 of 1 is 100% of the set. Still just one task ticked off.
    expect(decideDeletionReview({ syncedCount: 1, missingCount: 1 }).guardTripped).toBe(false);
    expect(decideDeletionReview({ syncedCount: 2, missingCount: 1 }).guardTripped).toBe(false);
  });

  it('ignores the fraction on sets too small for it to mean anything', () => {
    // 2 of 3 is a big fraction but a tiny set; the floor is 4 synced items.
    expect(decideDeletionReview({ syncedCount: 3, missingCount: 2 }).guardTripped).toBe(false);
    // Same proportion, past the floor: withheld.
    expect(decideDeletionReview({ syncedCount: 4, missingCount: 2 }).guardTripped).toBe(true);
  });
});

describe('decideDeletionReview — thresholds', () => {
  it('honours caller-supplied thresholds', () => {
    const d = decideDeletionReview({
      syncedCount: 100,
      missingCount: 3,
      massDelete: { maxItems: 2, maxFraction: 0.9 },
    });
    expect(d.guardTripped).toBe(true);
  });

  it('uses the same fraction the recipe framework actually runs', () => {
    // diff.ts prose says 25% but its code uses 0.5. Pinned so a future reader
    // reconciling the two cannot silently change behaviour here.
    expect(MASS_DELETE_FRACTION).toBe(0.5);
  });
});
