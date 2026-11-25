/**
 * The Screen tab's strip (#1349): where night and each switch's band sit on
 * a bar of a given width, no band narrower than 12px and none outside the
 * bar; and which switch rows a higher row covers.
 */
import { MIN_BAND_PX, stripGeometry, switchCoverage } from '../dayStrip';
import { switchSpans } from '../dayWaypoints';
import type { ScreenSwitch } from '../screenSwitches';

const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const span = (index: number, from: string, to: string) => ({ index, from: at(from), to: at(to), starts: true, ends: true });

describe('stripGeometry', () => {
  // 1440 px: a pixel a minute.
  const W = 1440;

  it('places night and each band at its minutes', () => {
    const g = stripGeometry({ width: W, nights: [{ from: 0, to: at('06:30') }, { from: at('21:00'), to: 1440 }], spans: [span(0, '16:00', '18:00')], now: at('10:15') });
    expect(g.nights).toEqual([{ left: 0, width: 390 }, { left: 1260, width: 180 }]);
    expect(g.bands).toEqual([{ index: 0, from: 960, to: 1080, left: 960, width: 120 }]);
    expect(g.now).toBe(615);
  });

  it('never draws a band narrower than 12px, at any width', () => {
    for (const width of [240, 320, 480]) {
      const g = stripGeometry({ width, nights: [], spans: [span(0, '07:00', '07:15'), span(1, '12:00', '12:01')], now: 0 });
      for (const b of g.bands) expect(b.width).toBeGreaterThanOrEqual(MIN_BAND_PX);
      // A long band keeps its own width.
      expect(stripGeometry({ width, nights: [], spans: [span(0, '06:00', '18:00')], now: 0 }).bands[0]!.width).toBe(width / 2);
    }
  });

  it('a short band at either end grows inwards, staying inside the bar', () => {
    const g = stripGeometry({ width: 300, nights: [], spans: [span(0, '23:58', '24:00'), span(1, '00:00', '00:02')], now: 0 });
    const end = g.bands.find((b) => b.index === 0)!;
    expect(end.left + end.width).toBeCloseTo(300);
    expect(end.width).toBe(MIN_BAND_PX);
    expect(g.bands.find((b) => b.index === 1)).toMatchObject({ left: 0, width: MIN_BAND_PX });
  });

  it('draws higher rows last, so the one that wins an overlap is on top', () => {
    const g = stripGeometry({ width: W, nights: [], spans: [span(0, '07:00', '09:00'), span(1, '08:00', '10:00')], now: 0 });
    expect(g.bands.map((b) => b.index)).toEqual([1, 0]);
  });

  it('places a switch from switchSpans, as the canvas and the wall go by', () => {
    const switches: ScreenSwitch[] = [{ when: 'bus', dashboardId: 'bus' }];
    const spans = switchSpans(switches, 1, [{ id: 'am', scheduledTime: '07:45', activeDays: [1] }]);
    expect(stripGeometry({ width: W, nights: [], spans, now: 0 }).bands).toEqual([{ index: 0, from: 435, to: 480, left: 435, width: 45 }]);
  });
});

describe('switchCoverage', () => {
  const times = (days: number[], from: string, to: string, dashboardId = 'x'): ScreenSwitch => ({ when: 'times', days, from, to, dashboardId });

  it('says which rows a higher one covers, all of them or some', () => {
    expect(switchCoverage([
      times([0, 1, 2, 3, 4, 5, 6], '07:00', '09:00'),
      times([1, 2, 3, 4, 5], '07:30', '08:00'),
      times([1], '08:30', '10:00'),
      times([1], '12:00', '13:00'),
    ])).toEqual([
      { shows: 'always', by: [] },
      { shows: 'never', by: [0] },
      { shows: 'partly', by: [0] },
      { shows: 'always', by: [] },
    ]);
  });

  it('a bus switch with no route is never in force; one under bus time is covered on its days', () => {
    const routes = [{ id: 'am', scheduledTime: '07:45', activeDays: [1, 2, 3, 4, 5] }];
    expect(switchCoverage([{ when: 'bus', dashboardId: 'bus' }, times([1, 2, 3, 4, 5], '07:30', '07:50')], routes))
      .toEqual([{ shows: 'always', by: [] }, { shows: 'never', by: [0] }]);
    expect(switchCoverage([{ when: 'bus', dashboardId: 'bus' }], [])).toEqual([{ shows: 'idle', by: [] }]);
  });

  it('a higher row to a deleted dashboard covers nothing', () => {
    expect(switchCoverage([times([1], '07:00', '09:00', 'gone'), times([1], '07:30', '08:00')], [], (id) => id !== 'gone'))
      .toEqual([{ shows: 'never', by: [] }, { shows: 'always', by: [] }]);
  });
});
