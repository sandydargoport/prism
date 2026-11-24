/**
 * @jest-environment jsdom
 *
 * One save rule (#1341): changing the dashboard being edited, or the screen,
 * with changes Done has not saved asks Save and switch, Discard or Stay; and
 * Make the default writes nothing until Done.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LayoutEditor } from '../LayoutEditor';

const mockHost: { displayId: string; dashboardId: null; switches: never[]; settings: Record<string, string>; next?: string | null; pending: () => { keys: string[]; plan: boolean } } = {
  displayId: 'kitchen', dashboardId: null, switches: [], settings: {}, pending: () => ({ keys: [], plan: false }),
};
jest.mock('@/lib/displays/remoteEdit', () => ({
  ...jest.requireActual('@/lib/displays/remoteEdit'),
  remoteEditHost: () => mockHost,
  remotePortalRoot: () => undefined,
}));
jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: 'America/Chicago' }),
}));

const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ displays: [{ id: 'kitchen', name: 'Hallway' }, { id: 'main', name: 'Main' }] }) }));

const dashboards = [
  { id: 'a', name: 'Hallway', slug: 'hallway', isDefault: false },
  { id: 'b', name: 'Main', slug: 'main', isDefault: true },
];

function editor(extra: Partial<React.ComponentProps<typeof LayoutEditor>> = {}) {
  const calls = {
    onSave: jest.fn(async () => {}),
    onSaveDashboard: jest.fn(async () => {}),
    onSwitchDashboard: jest.fn(),
    onMakeDefault: jest.fn(),
  };
  render(
    <LayoutEditor
      widgets={[]} onWidgetsChange={() => {}} onSaveAs={() => {}} onReset={() => {}} onCancel={() => {}}
      screenId="kitchen" screenPlan={{ dashboardId: null, switches: [] }}
      allDashboards={dashboards} currentDashboardId="a" layoutName="Hallway"
      {...calls} {...extra}
    />,
  );
  return calls;
}

const openTab = async (tab: string) => {
  fireEvent.click(document.querySelector<HTMLElement>(`[data-editor-open="${tab}"]`)!);
  await act(async () => {});
};
const pickDashboard = async (id: string) => {
  await openTab('dashboard');
  fireEvent.click(document.querySelector<HTMLElement>(`[data-dashboard-row="${id}"]`)!);
  await act(async () => {});
};
const choose = async (label: string) => {
  fireEvent.click(screen.getByRole('button', { name: label }));
  await act(async () => {});
};

beforeEach(() => {
  fetchMock.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
  mockHost.next = null;
  mockHost.pending = () => ({ keys: [], plan: false });
  sessionStorage.clear();
  localStorage.clear();
});

describe('changing the dashboard being edited', () => {
  it('with nothing changed, switches without asking', async () => {
    const calls = editor();
    await pickDashboard('b');
    expect(document.querySelector('[data-switch-prompt]')).toBeNull();
    expect(calls.onSwitchDashboard).toHaveBeenCalledWith('main');
  });

  it('with changes, asks the three choices', async () => {
    editor({ dashboardDirty: true });
    await pickDashboard('b');
    expect(document.querySelector('[data-switch-prompt]')).not.toBeNull();
    for (const label of ['Save and switch', 'Discard', 'Stay']) expect(screen.getByRole('button', { name: label })).toBeTruthy();
  });

  it('Stay stays, saving nothing', async () => {
    const calls = editor({ dashboardDirty: true });
    await pickDashboard('b');
    await choose('Stay');
    expect(calls.onSwitchDashboard).not.toHaveBeenCalled();
    expect(calls.onSaveDashboard).not.toHaveBeenCalled();
    expect(calls.onSave).not.toHaveBeenCalled();
  });

  it('Discard switches without saving', async () => {
    const calls = editor({ idleDirty: true });
    await pickDashboard('b');
    await choose('Discard');
    expect(calls.onSaveDashboard).not.toHaveBeenCalled();
    expect(calls.onSwitchDashboard).toHaveBeenCalledWith('main');
  });

  it('Save and switch saves this dashboard first, and stays in the editor', async () => {
    const calls = editor({ lookDirty: true });
    await pickDashboard('b');
    await choose('Save and switch');
    expect(calls.onSaveDashboard).toHaveBeenCalledTimes(1);
    expect(calls.onSwitchDashboard).toHaveBeenCalledWith('main');
    expect(calls.onSaveDashboard.mock.invocationCallOrder[0]!).toBeLessThan(calls.onSwitchDashboard.mock.invocationCallOrder[0]!);
    // Not Done: the screen's own changes stay held on the editor page.
    expect(calls.onSave).not.toHaveBeenCalled();
  });
});

describe('changing the screen being edited', () => {
  const pickScreen = async (id: string) => {
    await openTab('screen');
    fireEvent.change(document.querySelector<HTMLSelectElement>('[data-screen-pick]')!, { target: { value: id } });
    await act(async () => {});
  };

  it('with the screen\'s own settings changed, asks; Stay stays', async () => {
    mockHost.pending = () => ({ keys: ['prism-perf-mode'], plan: false });
    const calls = editor();
    await pickScreen('main');
    expect(document.querySelector('[data-switch-prompt]')).not.toBeNull();
    await choose('Stay');
    expect(calls.onSave).not.toHaveBeenCalled();
    expect(mockHost.next).toBeNull();
  });

  it('Save and switch is Done, which then opens the other screen\'s editor', async () => {
    const calls = editor({ dashboardDirty: true });
    await pickScreen('main');
    await choose('Save and switch');
    expect(calls.onSave).toHaveBeenCalledTimes(1);
    expect(mockHost.next).toBe('/screens/main');
  });
});

describe('Make the default (#1341)', () => {
  it('writes nothing and reloads nothing: Done makes it so', async () => {
    const calls = editor();
    await openTab('dashboard');
    fetchMock.mockClear();
    fireEvent.click(document.querySelector<HTMLElement>('[data-dashboard-default]')!);
    await act(async () => {});
    expect(calls.onMakeDefault).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says it waits for Done once pressed', async () => {
    editor({ defaultPending: true });
    await openTab('dashboard');
    const button = document.querySelector<HTMLButtonElement>('[data-dashboard-default]')!;
    expect(button.textContent).toBe('The default after Done');
    expect(button.disabled).toBe(true);
  });
});
