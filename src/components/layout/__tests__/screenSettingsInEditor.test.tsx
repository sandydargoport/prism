/**
 * @jest-environment jsdom
 *
 * Everything about a screen is set in its editor (#1267). Every setting a
 * screen keeps has a control on one of the editor's sheets, so none is left
 * to Settings, which is only the list of screens. A setting added to
 * SCREEN_SETTING_KEYS without a control fails here, as the table below must
 * name where each one is set.
 */
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import { SCREEN_SETTING_KEYS, type ScreenSettingKey } from '@/lib/displays/screenSettings';
import { ScreensaverSettingsPanel } from '@/components/screensaver/ScreensaverQuickSettings';
import type { ScreenPlan } from '@/lib/screenSwitches';
import { LookSheet, MoreSheet } from '../EditorSheets';
import { ScreenSheet } from '../ScreenSheet';

jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', householdTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
}));
jest.mock('@/components/screensaver/useIdleBackground', () => ({
  useSkyLocation: () => ({ lat: 45, lon: -100 }),
}));
// A named screen, which is the one whose notices can be set.
jest.mock('@/lib/displays/displaySettingsSync', () => ({
  ...jest.requireActual('@/lib/displays/displaySettingsSync'),
  loadBase: () => ({ displayId: 'kitchen', settings: {} }),
}));

/** The editor's places a setting can be set. */
type Place = 'Look' | 'Screensaver motion' | 'Screen' | 'More, notices';

/** Where each setting is set, by the label of its control; or why it has none. */
const CONTROLS: Record<ScreenSettingKey, { on: Place; label: RegExp } | { none: string }> = {
  'prism-screensaver-timeout': { on: 'Screen', label: /^Rest after/ },
  'prism-screensaver-interval': { on: 'Screensaver motion', label: /^Change photo every/ },
  'prism-screensaver-motion': { on: 'Screensaver motion', label: /^Transition effect/ },
  'prism-screensaver-motion-v2': { on: 'Screensaver motion', label: /^Transition effect/ },
  'prism-screensaver-motion-interval': { on: 'Screensaver motion', label: /^Change every/ },
  'prism-screensaver-min-widgets': { on: 'Screensaver motion', label: /^Show at least/ },
  'prism-screensaver-max-widgets': { on: 'Screensaver motion', label: /^and at most/ },
  'prism-screensaver-outlines': { on: 'Screensaver motion', label: /^Hide widget outlines/ },
  'prism-screensaver-shortcut': { on: 'Screensaver motion', label: /^Settings shortcut/ },
  'prism-screensaver-drift': { on: 'Screensaver motion', label: /^Drift/ },
  'prism-screensaver-carbonation': { on: 'Screensaver motion', label: /^Carbonation/ },
  'prism-screensaver-wobble': { on: 'Screensaver motion', label: /^Surface wobble/ },
  'prism-screensaver-speed': { on: 'Screensaver motion', label: /^Transition length/ },
  'prism-screensaver-water-clear': { on: 'Screensaver motion', label: /^Keep text clear of the waterline/ },
  // Moved into the screen's day by 0057 (#1345); still read on a browser
  // with no day of its own, never written.
  'prism-screensaver-dim': { none: 'moved into prism-screen-day; read only as a fallback' },
  // The screen's day (#1345): how much darker here; its looks and night rule
  // are on Through the day, which saves them on Done.
  'prism-screen-day': { on: 'Screen', label: /^How dark at night/ },
  'prism-perf-mode': { on: 'Look', label: /^Performance$/ },
  'prism:keyboard-on-this-device': { on: 'Look', label: /^On-screen keyboard$/ },
  'prism-orientation-override': { on: 'Look', label: /^Orientation$/ },
  'prism:auto-hide-ui': { on: 'Look', label: /^Auto-hide navigation$/ },
  'prism-idle-logout-minutes': { on: 'Look', label: /^Sign out after$/ },
  'prism-screen-attention': { on: 'More, notices', label: /^An event starts within/ },
  'prism-theme': { on: 'Screen', label: /^Light or dark$/ },
  'prism-wallpaper-enabled': { on: 'Screen', label: /^Photos behind the dashboard$/ },
  'prism-wallpaper-interval': { on: 'Screen', label: /^New photo every$/ },
  // Kept with the screen (#1340), set on the screen itself for now.
  'prism-seasonal-theme': { none: 'Settings > Appearance > Seasonal Theme, on the screen' },
  'prism-wallpaper-auto-orientation': { none: 'Settings > Appearance > Background Wallpaper, on the screen' },
  'prism-pinned-wallpaper': { none: 'Settings > Photos, on the screen' },
  'prism-pinned-screensaver': { none: 'Settings > Photos, on the screen' },
  'prism:display-timezone-mode': { none: 'Settings > General, on the screen' },
  // Kept with the screen so it survives a browser reset, but set by hand for a
  // screen whose bezel covers its edges: nothing sets it, Settings included.
  'prism:screen-safe-zones': { none: 'set by hand; no control anywhere' },
};

/** The Screen sheet for a screen: its own Rest after and How dark (#1326). */
function Screen() {
  const [plan, setPlan] = useState<ScreenPlan | null>({ dashboardId: null, switches: [] });
  return (
    <ScreenSheet
      idleBackground={{ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }}
      screenId="kitchen" forScreen screenPlan={plan} onScreenPlanChange={setPlan}
    />
  );
}

const PLACES: Record<Place, () => React.ReactElement> = {
  'Look': () => <LookSheet orientation="landscape" onMeasure={() => {}} />,
  'Screensaver motion': () => <ScreensaverSettingsPanel open onClose={() => {}} />,
  'Screen': () => <Screen />,
  'More, notices': () => (
    <MoreSheet builtIn={false} editingScreensaver={false} hasIdleLayout={false} idleTab={false} exportFeedback=""
      onExport={() => {}} onImportOpen={() => {}} onShareOpen={() => {}} onReset={() => {}} />
  ),
};

describe('every screen setting has a control in the editor (#1267)', () => {
  beforeEach(() => {
    // Every control of the screensaver's motion shows: it moves, as water.
    localStorage.setItem('prism-screensaver-motion-v2', 'liquid');
    localStorage.setItem('prism-screensaver-motion', 'liquid');
  });
  afterEach(() => localStorage.clear());

  it('names a place for every setting a screen keeps', () => {
    expect(Object.keys(CONTROLS).sort()).toEqual([...SCREEN_SETTING_KEYS].sort());
  });

  for (const key of SCREEN_SETTING_KEYS) {
    const where = CONTROLS[key];
    if ('none' in where) continue;
    it(`${key}: ${where.on}`, () => {
      render(PLACES[where.on]());
      expect(screen.getAllByLabelText(where.label).length).toBeGreaterThan(0);
    });
  }
});
