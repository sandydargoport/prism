import { BUS_MARKERS, SEASON_EMOJI, busMarkerSvg, isBusMarker } from '../busMarkers';

describe('bus markers', () => {
  it('draws every marker as one complete svg', () => {
    for (const kind of BUS_MARKERS) {
      const svg = busMarkerSvg(kind);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.match(/<svg/g)).toHaveLength(1);
      expect(svg).not.toMatch(/NaN|undefined/);
    }
  });

  it('accepts only known markers, so a setting cannot inject markup', () => {
    expect(isBusMarker('saucer')).toBe(true);
    expect(isBusMarker('<img onerror=x>')).toBe(false);
    expect(isBusMarker(3)).toBe(false);
  });

  it('decorates every month', () => {
    for (let m = 1; m <= 12; m++) expect(SEASON_EMOJI[m]).toBeTruthy();
  });
});

import { driverLabel, isDriverNames } from '@/lib/services/bus-driver-names';

describe('driver names', () => {
  it('shows the family choice, else the reported name', () => {
    expect(driverLabel('Sam Example', { 'Sam Example': 'Mr. Example' })).toBe('Mr. Example');
    expect(driverLabel('Sam Example', { 'Sam Example': '  ' })).toBe('Sam Example');
    expect(driverLabel('Sam Example', {})).toBe('Sam Example');
    expect(driverLabel(null, {})).toBeNull();
  });

  it('accepts only a map of short strings', () => {
    expect(isDriverNames({ 'Sam Example': 'Mr. Example' })).toBe(true);
    expect(isDriverNames(['x'])).toBe(false);
    expect(isDriverNames({ a: 3 })).toBe(false);
    expect(isDriverNames({ a: 'x'.repeat(61) })).toBe(false);
  });
});
