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
