/**
 * @jest-environment jsdom
 *
 * The Idle screen tab's Behind it bar (#782): one background, or one by day
 * and one after dark, switching at dusk and dawn with an offset on each edge,
 * or at set times; offsets that cross are refused.
 */

import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IdleBackgroundBar, idleSaveProblem } from '../IdleBackgroundBar';
import type { IdleBackground } from '@/lib/idleBackground';
import type { IdleHalf } from '@/components/dashboard/useDashboardLayout';
import type { IdleSwitchCheck } from '../useIdleSwitchCheck';

jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h' }),
}));

// What the bar last handed up, read by the assertions.
const seen: { value?: IdleBackground; half?: IdleHalf } = {};

function Harness({ initial, check = {} }: { initial: IdleBackground; check?: IdleSwitchCheck }) {
  const [value, setValue] = useState(initial);
  const [half, setHalf] = useState<IdleHalf>('day');
  React.useEffect(() => { seen.value = value; seen.half = half; });
  return <IdleBackgroundBar value={value} onChange={setValue} half={half} onHalfChange={setHalf} check={check} />;
}

const radio = (name: string) => screen.getByRole('radio', { name });

describe('IdleBackgroundBar', () => {
  it('picks one background', () => {
    render(<Harness initial={{ source: 'dashboard' }} />);
    expect(radio('This dashboard').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radio('Night sky'));
    expect(seen.value).toEqual({ source: 'sky' });
  });

  it('turns one background into a day and night pair switching at dusk and dawn', () => {
    render(<Harness initial={{ source: 'photos' }} />);
    fireEvent.click(radio('Changes with the time of day'));
    expect(seen.value).toEqual({ day: 'photos', night: 'sky', switch: { by: 'sun', duskOffset: 0, dawnOffset: 0 } });
    // The Day / Night preview switch appears, and moves the canvas to the half.
    fireEvent.click(screen.getByRole('button', { name: 'Night' }));
    expect(seen.half).toBe('night');
  });

  it('moves each edge by minutes or hours, before or after', () => {
    render(<Harness initial={{ day: 'dashboard', night: 'sky', switch: { by: 'sun', duskOffset: 0, dawnOffset: 0 } }} />);
    fireEvent.change(screen.getByLabelText('Starts: amount'), { target: { value: '30' } });
    expect(seen.value).toMatchObject({ switch: { duskOffset: 30 } });
    fireEvent.change(screen.getByLabelText('Starts: before or after'), { target: { value: 'before' } });
    expect(seen.value).toMatchObject({ switch: { duskOffset: -30 } });

    fireEvent.change(screen.getByLabelText('Ends: unit'), { target: { value: 'hr' } });
    fireEvent.change(screen.getByLabelText('Ends: amount'), { target: { value: '1' } });
    expect(seen.value).toMatchObject({ switch: { dawnOffset: -60 } });
    fireEvent.change(screen.getByLabelText('Ends: before or after'), { target: { value: 'after' } });
    expect(seen.value).toMatchObject({ switch: { duskOffset: -30, dawnOffset: 60 } });
  });

  it('shows tonight\'s actual times with the offsets applied', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 52);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 5, 41);
    render(<Harness
      initial={{ day: 'photos', night: 'sky', switch: { by: 'sun', duskOffset: 30, dawnOffset: -60 } }}
      check={{ night: { start, end } }}
    />);
    expect(document.querySelector('[data-night-start]')!.textContent).toBe('(tonight 18:52)');
    expect(document.querySelector('[data-night-end]')!.textContent).toBe('(tomorrow 05:41)');
  });

  it('switches at set times instead', () => {
    render(<Harness initial={{ day: 'photos', night: 'sky', switch: { by: 'sun', duskOffset: 0, dawnOffset: 0 } }} />);
    fireEvent.click(screen.getByLabelText('At set times'));
    expect(seen.value).toMatchObject({ switch: { by: 'clock', from: '21:00', to: '06:30' } });
    fireEvent.change(screen.getByLabelText('Night starts'), { target: { value: '22:15' } });
    expect(seen.value).toMatchObject({ switch: { by: 'clock', from: '22:15', to: '06:30' } });
  });

  it('says so, and refuses Save, when the offsets cross', () => {
    const bg: IdleBackground = { day: 'photos', night: 'sky', switch: { by: 'sun', duskOffset: 360, dawnOffset: -360 } };
    const check = { crossed: new Date(2027, 5, 21) };
    render(<Harness initial={bg} check={check} />);
    expect(screen.getByRole('alert').textContent).toContain('night would end before it starts around June 21');
    expect(idleSaveProblem(bg, check)).toMatch(/end before it starts/);
    expect(idleSaveProblem(bg, {})).toBeNull();
    expect(idleSaveProblem({ source: 'sky' }, check)).toBeNull();
  });
});
