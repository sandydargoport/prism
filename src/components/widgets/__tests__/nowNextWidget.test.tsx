/**
 * @jest-environment jsdom
 */
/**
 * Now & Next widget (#806): the lines a family reads from across the room.
 */
import * as React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/components/widgets/WidgetContainer', () => ({
  WidgetContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'America/Chicago', householdTimezone: 'America/Chicago' }),
}));
jest.mock('@/lib/hooks/useBusTracking', () => ({ useBusTracking: () => ({ routes: [] }) }));

import { NowNextWidget } from '../NowNextWidget';
import type { CalendarEvent } from '@/types/calendar';
import type { BusRouteStatus } from '@/lib/hooks/useBusTracking';

const NOW = new Date('2026-06-17T21:10:00Z'); // 4:10 PM Chicago

function ev(id: string, title: string, start: string, end: string): CalendarEvent {
  return { id, title, startTime: new Date(start), endTime: new Date(end), allDay: false, color: '#3B82F6' } as CalendarEvent;
}

const line = (name: string) => document.querySelector(`[data-now-next="${name}"]`) as HTMLElement | null;

describe('NowNextWidget', () => {
  it('shows what is on now, until when, and what is next with a countdown', () => {
    render(
      <NowNextWidget
        now={NOW}
        busRoutes={[]}
        events={[
          ev('a', 'Soccer Practice', '2026-06-17T21:00:00Z', '2026-06-17T22:30:00Z'),
          ev('b', 'Scouts Meeting', '2026-06-17T23:00:00Z', '2026-06-18T00:00:00Z'),
        ]}
      />,
    );
    expect(line('now')!.textContent).toContain('Soccer Practice');
    expect(line('now')!.textContent).toContain('until 5:30');
    expect(line('next')!.textContent).toContain('Scouts Meeting');
    expect(line('next')!.textContent).toContain('6:00');
    expect(line('next')!.textContent).toContain('in 1 h 50 min');
    expect(line('next')!.dataset.warn).toBeUndefined();
  });

  it('turns the next line amber, as a solid fill, ten minutes before it starts', () => {
    render(<NowNextWidget now={NOW} busRoutes={[]} events={[ev('b', 'Piano Recital', '2026-06-17T21:18:00Z', '2026-06-17T22:00:00Z')]} />);
    const next = line('next')!;
    expect(next.dataset.warn).toBe('true');
    expect(next.className).toContain('bg-warning');
    expect(next.textContent).toContain('starts in 8 min');
  });

  it('says so when today is empty, and when today is over', () => {
    const { unmount } = render(<NowNextWidget now={NOW} busRoutes={[]} events={[]} />);
    expect(screen.getByText('Today: no events')).toBeTruthy();
    unmount();
    render(<NowNextWidget now={NOW} busRoutes={[]} events={[ev('l', 'Lunch', '2026-06-17T17:00:00Z', '2026-06-17T18:00:00Z')]} />);
    expect(screen.getByText('Nothing else today')).toBeTruthy();
  });

  it('gives a bus on its way its time at the stop, not a made-up leave-by time', () => {
    const route = {
      id: 'r1', label: 'Morning bus', studentName: 'Robin', direction: 'AM', scheduledTime: '16:20', activeDays: [1, 2, 3, 4, 5],
      checkpoints: [], stopName: 'Corner', schoolName: 'School',
      prediction: { status: 'in_transit', etaMinutes: 12, etaRangeLow: 10, etaRangeHigh: 14, lastCheckpointName: null, lastCheckpointTime: null, lastCheckpointIndex: 0, totalCheckpoints: 3, minutesSinceLastCheckpoint: 2 },
    } as BusRouteStatus;
    render(<NowNextWidget now={NOW} busRoutes={[route]} events={[]} />);
    const bus = line('bus')!;
    expect(bus.textContent).toContain('Morning bus');
    expect(bus.textContent).toContain('at the stop 4:22 PM');
    expect(bus.textContent).toContain('in 12 min');
    expect(bus.textContent).not.toMatch(/leave/i);
  });
});
