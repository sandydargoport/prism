/**
 * The sentence a screen says about itself (#1349), from the same scene the
 * wall runs: what it shows, each switch, how it idles by day and at night,
 * and what will not happen.
 */
import { daysInWords, idleAfterInWords, screenSentence, type ScreenSentenceInput } from '../screenSentence';
import type { ScreenSwitch } from '../screenSwitches';
import { DEFAULT_NIGHT } from '../throughTheDay';

const NAMES: Record<string, string> = { main: 'Main', bus: 'Bus board', homework: 'Homework' };
const ROUTES = [
  { id: 'am', scheduledTime: '07:45', activeDays: [1, 2, 3, 4, 5] },
  { id: 'pm', scheduledTime: '15:30', activeDays: [1, 2, 3, 4, 5] },
];
const BUS: ScreenSwitch = { when: 'bus', dashboardId: 'bus' };
const HOMEWORK: ScreenSwitch = { when: 'times', days: [1, 2, 3, 4, 5], from: '16:00', to: '18:00', dashboardId: 'homework' };
const clock12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h! >= 12 ? 'PM' : 'AM'}`;
};

const base: ScreenSentenceInput = {
  name: 'Hallway',
  normally: 'Main',
  switches: [],
  dashboardName: (id) => NAMES[id] ?? null,
  routes: ROUTES,
  background: { source: 'photos' },
  nightLevel: 50,
  idleAfter: 120,
  clock: clock12,
};
const say = (patch: Partial<ScreenSentenceInput>) => screenSentence({ ...base, ...patch });

describe('screenSentence', () => {
  it.each<[string, Partial<ScreenSentenceInput>, string]>([
    ['the model\'s own example', { switches: [BUS] },
      'Hallway shows Main. On school days it shows Bus board around bus time and stays awake for it. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker.'],
    ['a set time, then the bus', { switches: [HOMEWORK, BUS] },
      'Hallway shows Main. Mon to Fri, 4:00 PM to 6:00 PM it shows Homework. On school days it shows Bus board around bus time and stays awake for it. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker.'],
    ['a set time that stays awake, every day', { switches: [{ ...HOMEWORK, days: [0, 1, 2, 3, 4, 5, 6], staysAwake: true }] },
      'Hallway shows Main. Every day, 4:00 PM to 6:00 PM it shows Homework and stays awake for it. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker.'],
    ['a set time all day at weekends', { switches: [{ ...HOMEWORK, days: [0, 6], from: '00:00', to: '00:00' }] },
      'Hallway shows Main. Sat, Sun, all day it shows Homework. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker.'],
    ['bus time that does not stay awake', { switches: [{ ...BUS, staysAwake: false }] },
      'Hallway shows Main. On school days it shows Bus board around bus time. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker.'],
    ['bus time every day', { switches: [BUS], routes: [{ id: 'am', scheduledTime: '07:45', activeDays: [0, 1, 2, 3, 4, 5, 6] }] },
      'Hallway shows Main. Every day it shows Bus board around bus time and stays awake for it. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker.'],
    ['bus time on some days', { switches: [BUS], routes: [{ id: 'am', scheduledTime: '07:45', activeDays: [1, 3] }] },
      'Hallway shows Main. On Mon, Wed it shows Bus board around bus time and stays awake for it. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker.'],
    ['bus time with no route set up', { switches: [BUS], routes: [] },
      'Hallway shows Main. No bus route is set up, so it never shows Bus board. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker.'],
    ['bus time while the routes are not known yet', { switches: [BUS], routes: null },
      'Hallway shows Main. At bus time it shows Bus board and stays awake for it. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker.'],
    ['a switch to a dashboard since deleted', { switches: [{ ...HOMEWORK, dashboardId: 'gone' }] },
      'Hallway shows Main. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker.'],
    ['never idles', { switches: [BUS], idleAfter: 0 },
      'Hallway shows Main. On school days it shows Bus board around bus time and stays awake for it. It never idles, so it has no night look.'],
    ['too narrow to idle', { canIdle: false },
      'Hallway shows Main. Will not idle: too narrow.'],
    ['nothing changes at night', { nightLevel: 0 },
      'Hallway shows Main. Idle for 2 minutes, it becomes a photo frame. At night nothing changes.'],
    ['the night sky at night, darker', { background: { day: 'photos', night: 'sky', switch: DEFAULT_NIGHT }, nightLevel: 25 },
      'Hallway shows Main. Idle for 2 minutes, it becomes a photo frame. At night it becomes the night sky, 25% darker.'],
    ['another look at night, not darker', { background: { day: 'dashboard', night: 'photos', switch: DEFAULT_NIGHT }, nightLevel: 0 },
      'Hallway shows Main. Idle for 2 minutes, it becomes the dashboard, quieter. At night it becomes a photo frame.'],
    ['the quiet dashboard darker at night', { background: { source: 'dashboard' }, nightLevel: 75 },
      'Hallway shows Main. Idle for 2 minutes, it becomes the dashboard, quieter. At night the quiet dashboard is 75% darker.'],
    ['screen off at night', { background: { day: 'photos', night: 'off', switch: DEFAULT_NIGHT } },
      'Hallway shows Main. Idle for 2 minutes, it becomes a photo frame. At night the screen turns off.'],
    ['idle after 30 seconds', { idleAfter: 30, nightLevel: 0 },
      'Hallway shows Main. Idle for 30 seconds, it becomes a photo frame. At night nothing changes.'],
    ['a screen nobody named', { name: null, nightLevel: 0 },
      'This screen shows Main. Idle for 2 minutes, it becomes a photo frame. At night nothing changes.'],
  ])('%s', (_, patch, words) => {
    expect(say(patch)).toBe(words);
  });

  it('says idle and night as the scene function does: a change there changes the sentence', () => {
    // The night look and its darkness come from screenStateAt, not a copy of its rules.
    const scene = jest.requireActual('../throughTheDay') as typeof import('../throughTheDay');
    const spy = jest.spyOn(scene, 'screenStateAt');
    say({});
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ idle: true, at: { night: true }, dimLevel: 0.5 }));
    spy.mockRestore();
  });
});

describe('the words it is made of', () => {
  it('days', () => {
    expect(daysInWords([1, 2, 3, 4, 5])).toBe('Mon to Fri');
    expect(daysInWords([0, 6])).toBe('Sat, Sun');
    expect(daysInWords([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
  });
  it('how long until idle', () => {
    expect([30, 60, 120, 600, 3600].map(idleAfterInWords)).toEqual(['30 seconds', '1 minute', '2 minutes', '10 minutes', '1 hour']);
  });
});
