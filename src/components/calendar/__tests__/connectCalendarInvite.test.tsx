/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { ConnectCalendarInvite, needsCalendarInvite } from '../ConnectCalendarInvite';

// A new install's calendar widget invites a connection instead of showing an
// empty list, and steps aside as soon as there is anything to show (#808).

describe('needsCalendarInvite', () => {
  const base = { loading: false, eventCount: 0, providers: ['local', 'local'] };

  it('invites when only the built-in local calendars exist and nothing is on them', () => {
    expect(needsCalendarInvite(base)).toBe(true);
  });

  it('steps aside once a real calendar is connected, even before it has events', () => {
    expect(needsCalendarInvite({ ...base, providers: ['local', 'google'] })).toBe(false);
    expect(needsCalendarInvite({ ...base, providers: ['caldav'] })).toBe(false);
  });

  it('steps aside when someone has added events by hand', () => {
    expect(needsCalendarInvite({ ...base, eventCount: 1 })).toBe(false);
  });

  it('waits for loading, so a connected install never flashes the invite', () => {
    expect(needsCalendarInvite({ ...base, loading: true })).toBe(false);
  });
});

describe('ConnectCalendarInvite', () => {
  it('says what to do and links to where calendars are connected', () => {
    render(<ConnectCalendarInvite />);
    expect(screen.getByText('Bring your calendars in')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Connect a calendar' });
    expect(link.getAttribute('href')).toBe('/calendar?manage=calendars');
  });
});
