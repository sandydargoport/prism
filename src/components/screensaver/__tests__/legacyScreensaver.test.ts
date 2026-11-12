/**
 * @jest-environment jsdom
 */
/**
 * The upgrade from v1.30.1 (#1154): the screensaver arrangement a browser kept
 * is carried onto the dashboard it shows, once, and only where it showed.
 */
import {
  legacyScreensaver,
  markScreensaverCarried,
  owesLegacyScreensaver,
  DEFAULT_SCREENSAVER_LAYOUT,
} from '../screensaverStorage';

const KEPT = [
  { i: 'clock', x: 2, y: 2, w: 16, h: 10, visible: true },
  { i: 'shopping', x: 24, y: 4, w: 14, h: 14, visible: true },
];

beforeEach(() => localStorage.clear());

describe('the arrangement a browser kept', () => {
  it('is read back merged onto the default, as v1.30.1 drew it', () => {
    localStorage.setItem('prism-screensaver-layout', JSON.stringify(KEPT));
    const legacy = legacyScreensaver()!;
    expect(legacy.find((w) => w.i === 'shopping')).toMatchObject({ x: 24, y: 4, visible: true });
    expect(legacy).toHaveLength(DEFAULT_SCREENSAVER_LAYOUT.length);
  });

  it('is none for a browser that kept nothing', () => {
    expect(legacyScreensaver()).toBeNull();
  });

  it('is none once carried, so it is offered only once', () => {
    localStorage.setItem('prism-screensaver-layout', JSON.stringify(KEPT));
    markScreensaverCarried();
    expect(legacyScreensaver()).toBeNull();
  });
});

describe('whether it is owed to the dashboard', () => {
  const legacy = KEPT;
  it('is owed to a dashboard with none of its own that rests over photos or the sky', () => {
    expect(owesLegacyScreensaver({ screensaverWidgets: null }, true, legacy)).toBe(true);
  });
  it('is not owed where the dashboard saved its own', () => {
    expect(owesLegacyScreensaver({ screensaverWidgets: [{ i: 'weather', x: 0, y: 0, w: 4, h: 4 }] }, true, legacy)).toBe(false);
  });
  it('is not owed to a dashboard that rests as itself, where no arrangement shows', () => {
    expect(owesLegacyScreensaver({ screensaverWidgets: null }, false, legacy)).toBe(false);
  });
  it('is not owed when the browser kept nothing', () => {
    expect(owesLegacyScreensaver({ screensaverWidgets: null }, true, null)).toBe(false);
  });
});
