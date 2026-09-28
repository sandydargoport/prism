/**
 * @jest-environment jsdom
 */
/**
 * The due label on a chore card.
 *
 * nextDue is a date. Read with new Date() it became UTC midnight, so west of
 * UTC a chore due tomorrow was "overdue" from the evening before, and on its
 * own day it read "Due 15 hours ago". Fixtures use local wall times, and
 * `npm run test:tz` runs this in zones on both sides of UTC.
 */
import { render, screen } from '@testing-library/react';
import { ChoreGroupCard, type ChoreCardData } from '../ChoreGroupCard';

function renderCard(chore: Partial<ChoreCardData>) {
  const full: ChoreCardData = { id: 'c1', title: 'Water the plants', pointValue: 1, ...chore };
  render(
    <ChoreGroupCard
      chore={full}
      assignedUser={null}
      allChores={[full]}
      onComplete={async () => true}
      onEdit={() => {}}
      onDelete={() => {}}
      setCelebratingUser={() => {}}
    />,
  );
}

describe('ChoreGroupCard due label', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // 20:30 local on 28 September: past 01:00 UTC for every zone west of UTC.
    jest.setSystemTime(new Date(2026, 8, 28, 20, 30));
  });
  afterEach(() => jest.useRealTimers());

  it('reads a chore due today as due today, not overdue', () => {
    renderCard({ nextDue: '2026-09-28' });
    expect(screen.getByText('Due today')).toBeTruthy();
  });

  it('reads a chore due tomorrow as due tomorrow', () => {
    renderCard({ nextDue: '2026-09-29' });
    expect(screen.getByText('Due tomorrow')).toBeTruthy();
  });

  it('marks a chore from an earlier day as overdue', () => {
    renderCard({ nextDue: '2026-09-27' });
    expect(screen.getByText(/^Due .* ago$/).parentElement!.className).toContain('text-destructive');
  });

  it('marks a timed chore overdue once its time has passed', () => {
    renderCard({ nextDue: '2026-09-28', nextDueTime: '18:00' });
    expect(screen.getByText(/^Due .* ago$/).parentElement!.className).toContain('text-destructive');
  });
});
