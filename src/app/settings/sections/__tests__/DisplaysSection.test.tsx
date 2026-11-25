/**
 * @jest-environment jsdom
 */

/**
 * Settings > Screens (#1351): each screen's row says its sentence, the one
 * its editor's Screen tab says, and has Edit, Rename and Remove but no
 * dashboard picker of its own. Below the list, New and unnamed screens show
 * a dashboard, with their idle and night look; both save at once.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

jest.mock('next/navigation', () => ({ usePathname: () => '/settings' }));
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
jest.mock('@/components/providers/TimeFormatProvider', () => ({ useTimeFormat: () => ({ timeFormat: '12h' }) }));

import { DisplaysSection } from '../DisplaysSection';

const MAIN = { id: 'main', name: 'Main', slug: null, isDefault: true, widgets: [] };
const BUS = { id: 'bus', name: 'Bus board', slug: 'bus-board', isDefault: false, widgets: [] };
const DAY = (patch: object = {}) => ({ day: 'photos', night: 'photos', switch: { by: 'sun', duskOffset: 30, dawnOffset: -30 }, nightLevel: 50, ...patch });

/** Two fictional screens: one with its own day and a time, one going by the household's. */
const HALLWAY = {
  id: 'hallway', name: 'Hallway', lastSeenAt: null, online: true, width: 1280, height: 800,
  dashboardId: null,
  switches: [{ when: 'times', days: [1, 2, 3, 4, 5], from: '07:00', to: '08:00', dashboardId: 'bus' }],
  settings: { 'prism-screen-day': JSON.stringify(DAY({ day: 'sky', night: 'sky', nightLevel: 25 })), 'prism-screensaver-timeout': '600' },
};
const DEN = {
  id: 'den', name: 'Den', lastSeenAt: null, online: false, width: 1280, height: 800,
  dashboardId: 'bus', switches: [], settings: { 'prism-screensaver-timeout': '0' },
};

let household: object;
const fetchMock = jest.fn();

function respond(url: string, init?: RequestInit) {
  const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });
  if (url === '/api/displays') return ok({ displays: [HALLWAY, DEN], currentId: null });
  if (url === '/api/layouts') return ok({ layouts: [MAIN, BUS] });
  if (url === '/api/settings' && !init?.method) return ok({ settings: { screenStartingDay: household } });
  return ok({});
}

beforeEach(() => {
  household = DAY();
  fetchMock.mockReset();
  fetchMock.mockImplementation(respond);
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  delete (global as { fetch?: unknown }).fetch;
});

async function shown() {
  render(<DisplaysSection />);
  await waitFor(() => expect(screen.getAllByTestId('display-row')).toHaveLength(2));
  await waitFor(() => expect(document.querySelectorAll('[data-screen-sentence]')).toHaveLength(2));
}
const row = (name: string) => screen.getAllByTestId('display-row').find((r) => r.textContent?.includes(name))!;
const writes = () => fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');

describe('Settings > Screens rows', () => {
  it('each row says the screen\'s sentence: what it shows, its times, and how it idles by day and at night', async () => {
    await shown();
    expect(row('Hallway').querySelector('[data-screen-sentence]')!.textContent).toBe(
      'Hallway shows Main. Mon to Fri, 7 AM to 8 AM it shows Bus board. Idle for 10 minutes, it becomes the night sky. At night the night sky is 25% darker.',
    );
    expect(row('Den').querySelector('[data-screen-sentence]')!.textContent).toBe(
      'Den shows Bus board. It never idles, so it has no night look.',
    );
  });

  it('a screen with no day of its own goes by the household\'s, as the wall does', async () => {
    household = DAY({ day: 'dashboard', night: 'off' });
    HALLWAY.settings = { 'prism-screensaver-timeout': '120' } as typeof HALLWAY.settings;
    try {
      await shown();
      expect(row('Hallway').querySelector('[data-screen-sentence]')!.textContent).toMatch(
        /Idle for 2 minutes, it becomes the dashboard, quieter\. At night the screen turns off\.$/,
      );
    } finally {
      HALLWAY.settings = { 'prism-screen-day': JSON.stringify(DAY({ day: 'sky', night: 'sky', nightLevel: 25 })), 'prism-screensaver-timeout': '600' };
    }
  });

  it('a row has Edit, Rename and Remove, and no dashboard picker of its own', async () => {
    await shown();
    const r = within(row('Hallway'));
    expect(r.getByRole('link', { name: 'Edit' }).getAttribute('href')).toContain('hallway');
    expect(r.getByRole('button', { name: 'Rename' })).toBeTruthy();
    expect(r.getByRole('button', { name: 'Remove' })).toBeTruthy();
    expect(r.queryByRole('combobox')).toBeNull();
    expect(row('Hallway').querySelector('[data-screen-dashboard]')).toBeNull();
  });
});

describe('New and unnamed screens show', () => {
  it('names the dashboard they show and their idle and night look', async () => {
    await shown();
    const card = document.querySelector<HTMLElement>('[data-new-screens]')!;
    const show = within(card).getByLabelText('New and unnamed screens show') as HTMLSelectElement;
    expect(show.value).toBe('main');
    expect((within(card).getByLabelText('Idle, by day') as HTMLSelectElement).value).toBe('photos');
    expect((within(card).getByLabelText(/^At night/) as HTMLSelectElement).value).toBe('same');
    expect((within(card).getByLabelText('Darker at night') as HTMLSelectElement).value).toBe('50');
  });

  it('another dashboard saves at once, as the default', async () => {
    await shown();
    fetchMock.mockClear();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('New and unnamed screens show'), { target: { value: 'bus' } });
    });
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]![0]).toBe('/api/layouts/bus/default');
    expect(writes()[0]![1]).toEqual(expect.objectContaining({ method: 'POST' }));
  });

  it('their idle and night look saves at once to the household\'s starting day', async () => {
    await shown();
    fetchMock.mockClear();
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/^At night/), { target: { value: 'off' } });
    });
    await waitFor(() => expect(writes()).toHaveLength(1));
    const [url, init] = writes()[0]!;
    expect(url).toBe('/api/settings');
    expect(JSON.parse(init.body)).toEqual({ key: 'screenStartingDay', value: DAY({ night: 'off' }) });
    // Screen off has no darker.
    expect(screen.queryByLabelText('Darker at night')).toBeNull();

    fetchMock.mockClear();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Idle, by day'), { target: { value: 'sky' } });
    });
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(JSON.parse(writes()[0]![1].body).value).toEqual(DAY({ day: 'sky', night: 'off' }));
  });

  it('a look that did not save is put back', async () => {
    await shown();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => (init?.method === 'PATCH'
      ? Promise.resolve({ ok: false, status: 403, json: async () => ({}) })
      : respond(url, init)));
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Darker at night'), { target: { value: '75' } });
    });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Only a parent can change screens.'));
    expect((screen.getByLabelText('Darker at night') as HTMLSelectElement).value).toBe('50');
  });
});
