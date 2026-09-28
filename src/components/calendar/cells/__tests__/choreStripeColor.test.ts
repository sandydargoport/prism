/**
 * The chore stripe turns red once the due date is in the past, measured by the
 * display zone's date, which is the date the calendar columns are drawn in.
 */
import { choreStripeColor } from '../DayColumn';

const OVERDUE = '#ef4444';
const PENDING = '#f59e0b';
const APPROVAL = '#a855f7';

describe('choreStripeColor', () => {
  afterEach(() => jest.useRealTimers());

  beforeEach(() => {
    jest.useFakeTimers();
    // The 28th in Chicago, already the 29th in Tokyo.
    jest.setSystemTime(new Date('2026-09-29T01:30:00Z'));
  });

  it('is not overdue on the due date in the display zone', () => {
    expect(choreStripeColor({ nextDue: '2026-09-28' }, 'America/Chicago')).toBe(PENDING);
  });

  it('is overdue once the display zone has moved past the due date', () => {
    expect(choreStripeColor({ nextDue: '2026-09-28' }, 'Asia/Tokyo')).toBe(OVERDUE);
  });

  it('shows a pending approval first', () => {
    expect(choreStripeColor({ nextDue: '2020-01-01', pendingApproval: {} }, 'Asia/Tokyo')).toBe(APPROVAL);
  });

  it('is pending with no due date', () => {
    expect(choreStripeColor({}, 'Asia/Tokyo')).toBe(PENDING);
  });
});
