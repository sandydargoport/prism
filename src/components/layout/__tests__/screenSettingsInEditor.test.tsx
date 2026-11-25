/**
 * @jest-environment jsdom
 *
 * Everything about a screen is set in its editor (#1267), on its Screen tab
 * (#1349). Every setting a screen keeps has a control there, so none is left
 * to Settings, which is only the list of screens. A setting added to
 * SCREEN_SETTING_KEYS without a control fails here, as the table below must
 * name where each one is set.
 */
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SCREEN_SETTING_KEYS, type ScreenSettingKey } from '@/lib/displays/screenSettings';
import type { ScreenPlan } from '@/lib/screenSwitches';
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

/** Where each setting is set on the Screen tab, by the label of its control; or why it has none. */
const CONTROLS: Record<ScreenSettingKey, { label: RegExp } | { none: string }> = {
  'prism-screensaver-timeout': { label: /^Idle after/ },
  'prism-screensaver-interval': { label: /^Change photo every/ },
  'prism-screensaver-motion': { label: /^Transition effect/ },
  'prism-screensaver-motion-v2': { label: /^Transition effect/ },
  'prism-screensaver-motion-interval': { label: /^Change every/ },
  'prism-screensaver-min-widgets': { label: /^Show at least/ },
  'prism-screensaver-max-widgets': { label: /^and at most/ },
  'prism-screensaver-outlines': { label: /^Outlines on the photo frame/ },
  // Only on the photo frame's own settings, which it goes with.
  'prism-screensaver-shortcut': { none: 'the photo frame\'s own settings; removed with them' },
  'prism-screensaver-drift': { label: /^Drift/ },
  'prism-screensaver-carbonation': { label: /^Carbonation/ },
  'prism-screensaver-wobble': { label: /^Surface wobble/ },
  'prism-screensaver-speed': { label: /^Transition length/ },
  'prism-screensaver-water-clear': { label: /^Keep text clear of the waterline/ },
  // Moved into the screen's day by 0057 (#1345); still read on a browser
  // with no day of its own, never written.
  'prism-screensaver-dim': { none: 'moved into prism-screen-day; read only as a fallback' },
  // The screen's day (#1345): how much darker here; its looks and night rule
  // beside it, saved on Done.
  'prism-screen-day': { label: /^Darker at night/ },
  'prism-perf-mode': { label: /^Performance$/ },
  'prism:keyboard-on-this-device': { label: /^On-screen keyboard$/ },
  'prism-orientation-override': { label: /^Orientation$/ },
  'prism:auto-hide-ui': { label: /^Auto-hide navigation$/ },
  'prism-idle-logout-minutes': { label: /^Sign out after$/ },
  'prism-screen-attention': { label: /^An event starts within/ },
  'prism-theme': { label: /^Light or dark$/ },
  'prism-wallpaper-enabled': { label: /^Photos behind the dashboard$/ },
  'prism-wallpaper-interval': { label: /^New photo every$/ },
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

/** The Screen tab for a screen, both Advanced folds open. */
function Screen() {
  const [plan, setPlan] = useState<ScreenPlan | null>({ dashboardId: null, switches: [] });
  return (
    <ScreenSheet
      idleBackground={{ day: 'photos', night: 'sky', switch: { by: 'clock', from: '21:00', to: '06:30' } }}
      screenId="kitchen" screenPlan={plan} onScreenPlanChange={setPlan}
    />
  );
}

function openFolds() {
  for (const b of screen.getAllByRole('button', { name: /^Advanced/ })) fireEvent.click(b);
}

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
    it(`${key}: on the Screen tab`, () => {
      render(<Screen />);
      openFolds();
      expect(screen.getAllByLabelText(where.label).length).toBeGreaterThan(0);
    });
  }

  it('the Look and More tabs hold none of them', async () => {
    const { LookSheet, MoreSheet } = await import('../EditorSheets');
    render(<>
      <LookSheet orientation="landscape" onMeasure={() => {}} />
      <MoreSheet builtIn={false} editingScreensaver={false} hasIdleLayout={false} idleTab={false} exportFeedback=""
        onExport={() => {}} onImportOpen={() => {}} onShareOpen={() => {}} onReset={() => {}} />
    </>);
    for (const where of Object.values(CONTROLS)) {
      if ('label' in where) expect(screen.queryAllByLabelText(where.label)).toHaveLength(0);
    }
  });
});
