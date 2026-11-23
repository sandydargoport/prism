/**
 * @jest-environment jsdom
 *
 * The Screen tab's unsaved dot (#1326): it shows when the screen's dashboard,
 * switches or own settings differ from when the editor page opened, as the
 * Widgets and Through the day tabs show theirs.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { LayoutEditor } from '../LayoutEditor';

let unsaved = false;
jest.mock('@/lib/displays/remoteEdit', () => ({
  ...jest.requireActual('@/lib/displays/remoteEdit'),
  remoteEditHost: () => ({ displayId: 'kitchen', dashboardId: null, switches: [], settings: {}, unsaved: () => unsaved }),
  remotePortalRoot: () => undefined,
}));
jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: 'America/Chicago' }),
}));

const dot = () => document.querySelector('[data-editor-open="screen"] [aria-label="unsaved changes"]');

beforeEach(() => {
  unsaved = false;
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
  fireEvent.change(document.querySelector<HTMLSelectElement>('[aria-label="Rest after"]')!, { target: { value: '3600' } });
  expect(dot()).not.toBeNull();
});
