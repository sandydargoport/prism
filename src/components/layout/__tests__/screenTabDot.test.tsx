/**
 * @jest-environment jsdom
 *
 * The Screen tab's unsaved dot (#1326): it shows when the screen's dashboard,
 * switches or own settings differ from when the editor page opened, as the
 * Widgets and Through the day tabs show theirs. Every tab has one (#1341).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LayoutEditor } from '../LayoutEditor';

let unsaved = false;
let pending: { keys: string[]; plan: boolean } | null = null;
jest.mock('@/lib/displays/remoteEdit', () => ({
  ...jest.requireActual('@/lib/displays/remoteEdit'),
  remoteEditHost: () => ({
    displayId: 'kitchen', dashboardId: null, switches: [], settings: {}, unsaved: () => unsaved,
    ...(pending ? { pending: () => pending } : {}),
  }),
  remotePortalRoot: () => undefined,
}));
jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: 'America/Chicago' }),
}));

const dotOn = (tab: string) => document.querySelector(`[data-editor-open="${tab}"] [aria-label="unsaved changes"]`);
const dot = () => dotOn('screen');
const dotted = () => ['screen', 'dashboard', 'widgets', 'day', 'look', 'more'].filter((t) => dotOn(t));

beforeEach(() => {
  unsaved = false;
  pending = null;
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ displays: [{ id: 'kitchen', name: 'Kitchen' }] }) })) as never;
});

it('marks the Screen tab when the screen has changes Done has not sent', async () => {
  const props = {
    widgets: [], onWidgetsChange: () => {}, onSave: async () => {}, onSaveAs: () => {}, onReset: () => {}, onCancel: () => {},
    screenId: 'kitchen', screenPlan: { dashboardId: null, switches: [] }, onScreenPlanChange: () => {},
    allDashboards: [{ id: 'a', name: 'Home', slug: 'home', isDefault: true }], currentDashboardId: 'a',
  };
  const { rerender } = render(<LayoutEditor {...props} />);
  await act(async () => {});
  expect(dot()).toBeNull();
  // A switch added: the plan the editor holds changes, and the host says so.
  unsaved = true;
  rerender(<LayoutEditor {...props} screenPlan={{ dashboardId: null, switches: [{ when: 'bus', dashboardId: 'a' }] }} />);
  expect(dot()).not.toBeNull();
});

it('a setting changed on the Screen tab shows the dot at once', async () => {
  render(<LayoutEditor widgets={[]} onWidgetsChange={() => {}} onSave={async () => {}} onSaveAs={() => {}} onReset={() => {}} onCancel={() => {}}
    screenId="kitchen" screenPlan={{ dashboardId: null, switches: [] }}
    allDashboards={[{ id: 'a', name: 'Home', slug: 'home', isDefault: true }]} currentDashboardId="a" />);
  await act(async () => {});
  fireEvent.click(document.querySelector<HTMLElement>('[data-editor-open="screen"]')!);
  await act(async () => {});
  expect(dot()).toBeNull();
  unsaved = true;
  fireEvent.change(screen.getByLabelText('Rest after'), { target: { value: '3600' } });
  expect(dot()).not.toBeNull();
});

describe('every tab shows its own dot (#1341)', () => {
  const props = {
    widgets: [], onWidgetsChange: () => {}, onSave: async () => {}, onSaveAs: () => {}, onReset: () => {}, onCancel: () => {},
    screenId: 'kitchen', screenPlan: { dashboardId: null, switches: [] },
    allDashboards: [{ id: 'a', name: 'Hallway', slug: 'hallway', isDefault: false }], currentDashboardId: 'a',
  };

  it('none with nothing changed', async () => {
    pending = { keys: [], plan: false };
    render(<LayoutEditor {...props} />);
    await act(async () => {});
    expect(dotted()).toEqual([]);
  });

  it('Dashboard, once Make the default is pressed', async () => {
    render(<LayoutEditor {...props} defaultPending />);
    await act(async () => {});
    expect(dotted()).toEqual(['dashboard']);
  });

  it('Look, for the screen shape or one of This screen\'s options', async () => {
    const { rerender } = render(<LayoutEditor {...props} lookDirty />);
    await act(async () => {});
    expect(dotted()).toEqual(['look']);
    pending = { keys: ['prism-perf-mode'], plan: false };
    rerender(<LayoutEditor {...props} />);
    expect(dotted()).toEqual(['look']);
  });

  it('More, for the screen\'s notices; Screen, for its other settings', async () => {
    pending = { keys: ['prism-screen-attention'], plan: false };
    const { rerender } = render(<LayoutEditor {...props} />);
    await act(async () => {});
    expect(dotted()).toEqual(['more']);
    pending = { keys: ['prism-screensaver-timeout'], plan: false };
    rerender(<LayoutEditor {...props} dashboardDirty idleDirty />);
    expect(dotted()).toEqual(['screen', 'widgets', 'day']);
  });
});
