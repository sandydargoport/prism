/**
 * The one question definition (#1311). A later question changes only this
 * data, so these hold for whatever it says: two or more answers, ids the
 * counter accepts, and openUntil closing the question when it passes.
 */
import { REFERENDUM, findAnswer, isReferendumOpen, type Referendum } from '../referendum';

// The collector's rule for a question or answer id (collector/worker.js, slug).
const COLLECTOR_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

describe('REFERENDUM', () => {
  it('has an id and two or more answers, each a slug the counter takes, none repeated', () => {
    expect(REFERENDUM.id).toMatch(COLLECTOR_SLUG);
    expect(REFERENDUM.question.trim()).not.toBe('');
    expect(REFERENDUM.answers.length).toBeGreaterThanOrEqual(2);
    for (const a of REFERENDUM.answers) {
      expect(a.id).toMatch(COLLECTOR_SLUG);
      expect(a.label.trim()).not.toBe('');
    }
    expect(new Set(REFERENDUM.answers.map((a) => a.id)).size).toBe(REFERENDUM.answers.length);
  });

  it('the first question: the bottom bar or the sidebar', () => {
    expect(REFERENDUM.id).toBe('2026-11-navigation');
    expect(REFERENDUM.answers.map((a) => a.id)).toEqual(['bottom-bar', 'sidebar']);
  });
});

describe('isReferendumOpen', () => {
  const q = (openUntil?: string): Referendum => ({ ...REFERENDUM, openUntil });

  it('is open with no end set', () => {
    expect(isReferendumOpen(q(), new Date('2030-01-01T00:00:00Z'))).toBe(true);
  });

  it('a date with no time stays open to the end of that day, then closes', () => {
    expect(isReferendumOpen(q('2026-12-31'), new Date('2026-12-31T23:59:00Z'))).toBe(true);
    expect(isReferendumOpen(q('2026-12-31'), new Date('2027-01-01T00:00:01Z'))).toBe(false);
  });

  it('a full timestamp closes at that moment', () => {
    expect(isReferendumOpen(q('2026-12-01T12:00:00Z'), new Date('2026-12-01T11:59:59Z'))).toBe(true);
    expect(isReferendumOpen(q('2026-12-01T12:00:00Z'), new Date('2026-12-01T12:00:01Z'))).toBe(false);
  });
});

describe('findAnswer', () => {
  it('finds only the answers the question has', () => {
    expect(findAnswer(REFERENDUM, 'sidebar')?.label).toBe('Bring back the sidebar');
    expect(findAnswer(REFERENDUM, 'top-bar')).toBeUndefined();
    expect(findAnswer(REFERENDUM, undefined)).toBeUndefined();
  });
});
