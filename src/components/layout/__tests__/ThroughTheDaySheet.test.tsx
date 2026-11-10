/**
 * @jest-environment jsdom
 *
 * The Through the day sheet (#1152): the strip of states shows the screen in
 * each, the slider plays the day, and the sheet sets what resting and night
 * are. A dashboard nobody gave a night is stored as before.
 */
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { daysInWords, simplest, ThroughTheDaySheet } from '../ThroughTheDaySheet';
import { idleSaveProblem } from '../IdleBackgroundBar';
import type { IdleBackground } from '@/lib/idleBackground';
import type { EditTab, IdleHalf } from '@/components/dashboard/useDashboardLayout';
import { DEFAULT_NIGHT } from '@/lib/throughTheDay';

jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: 'America/Chicago' }),
}));
jest.mock('@/components/screensaver/useIdleBackground', () => ({
  useSkyLocation: () => ({ lat: 45, lon: -100 }),
}));
jest.mock('@/components/screensaver/ScreensaverQuickSettings', () => ({ ScreensaverSettingsPanel: () => null }));

const seen: { value?: IdleBackground; half?: IdleHalf; tab?: EditTab } = {};

function Harness({ initial }: { initial: IdleBackground }) {
  const [value, setValue] = useState(initial);
  const [half, setHalf] = useState<IdleHalf>('day');
  const [tab, setTab] = useState<EditTab>('dashboard');
  React.useEffect(() => { seen.value = value; seen.half = half; seen.tab = tab; });
  return (
    <ThroughTheDaySheet
      idleBackground={value} onIdleBackgroundChange={setValue}
      idleHalf={half} onIdleHalfChange={setHalf}
      editTab={tab} onEditTabChange={setTab}
      idleCheck={{}}
    />
  );
}

const radio = (group: string, name: string) =>
  Array.from(screen.getByRole('radiogroup', { name: group }).querySelectorAll<HTMLElement>('[role="radio"]')).find((b) => b.textContent === name)!;

afterEach(() => localStorage.clear());

describe('ThroughTheDaySheet', () => {
  it('shows the screen in each state it is tapped to', () => {
    render(<Harness initial={{ source: 'dashboard' }} />);
    expect(radio('Show the screen', 'Active').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radio('Show the screen', 'Night'));
    expect(seen).toMatchObject({ tab: 'idle', half: 'night' });
    fireEvent.click(radio('Show the screen', 'Resting'));
    expect(seen).toMatchObject({ tab: 'idle', half: 'day' });
    fireEvent.click(radio('Show the screen', 'Active'));
    expect(seen.tab).toBe('dashboard');
  });

  it('plays the day: the slider shows the state at that time', () => {
    render(<Harness initial={{ day: 'dashboard', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }} />);
    const slider = screen.getByLabelText('Time of day');
    fireEvent.change(slider, { target: { value: String(21 * 60 + 30) } });
    expect(seen).toMatchObject({ tab: 'idle', half: 'night' });
    expect(screen.getByText(/^At 21:30: night/)).toBeTruthy();
    fireEvent.change(slider, { target: { value: String(10 * 60) } });
    expect(seen).toMatchObject({ tab: 'idle', half: 'day' });
  });

  it('sets a night look that turns the screen off, on the default night', () => {
    render(<Harness initial={{ source: 'photos' }} />);
    fireEvent.click(radio('Night look', 'Screen off'));
    expect(seen.value).toEqual({ day: 'photos', night: 'off', switch: DEFAULT_NIGHT });
    expect(seen.half).toBe('night');
  });

  it('turns dimming on when Dim this dashboard is chosen on a screen that does not dim', () => {
    render(<Harness initial={{ day: 'dashboard', night: 'sky', switch: DEFAULT_NIGHT }} />);
    fireEvent.click(radio('Night look', 'Dim this dashboard'));
    expect(seen.value).toEqual({ source: 'dashboard' });
    expect(localStorage.getItem('prism-screensaver-dim')).toBe('0.5');
  });

  it('sets night by the clock instead of the sun', () => {
    render(<Harness initial={{ source: 'dashboard' }} />);
    fireEvent.click(radio('When night is', 'Set times'));
    fireEvent.change(screen.getByLabelText('Night starts'), { target: { value: '22:15' } });
    expect(seen.value).toEqual({ day: 'dashboard', night: 'dashboard', switch: { by: 'clock', from: '22:15', to: '06:30' } });
  });

  it('moves night\'s edges behind More', () => {
    render(<Harness initial={{ source: 'dashboard' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.change(screen.getByLabelText('Ends: unit'), { target: { value: 'hr' } });
    fireEvent.change(screen.getByLabelText('Ends: amount'), { target: { value: '1' } });
    expect(seen.value).toEqual({ day: 'dashboard', night: 'dashboard', switch: { by: 'sun', duskOffset: 30, dawnOffset: -60 } });
  });

  it('asks for a named screen before it offers Interludes', () => {
    render(<Harness initial={{ source: 'dashboard' }} />);
    expect(document.querySelector('[data-interludes-unnamed]')).toBeTruthy();
  });
});

describe('simplest', () => {
  it('stores one background when day and night match on the default rule', () => {
    expect(simplest({ day: 'photos', night: 'photos', switch: DEFAULT_NIGHT })).toEqual({ source: 'photos' });
    const own = { day: 'photos' as const, night: 'photos' as const, switch: { by: 'sun' as const, duskOffset: 0, dawnOffset: 0 } };
    expect(simplest(own)).toBe(own);
  });
});

describe('daysInWords', () => {
  it('names the common sets', () => {
    expect(daysInWords([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(daysInWords([0, 6])).toBe('Weekends');
    expect(daysInWords([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(daysInWords([2, 4])).toBe('Tue, Thu');
  });
});

describe('idleSaveProblem', () => {
  it('refuses a night that starts and ends at the same time, and crossed offsets', () => {
    expect(idleSaveProblem({ day: 'dashboard', night: 'sky', switch: { by: 'clock', from: '21:00', to: '21:00' } }, {})).toMatch(/different times/);
    expect(idleSaveProblem({ source: 'dashboard' }, { crossed: new Date() })).toBeNull();
    expect(idleSaveProblem({ day: 'dashboard', night: 'sky', switch: DEFAULT_NIGHT }, { crossed: new Date() })).toMatch(/offsets/);
  });
});
