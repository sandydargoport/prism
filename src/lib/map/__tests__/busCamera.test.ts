import { LEAD_M, cameraView, needsReframe } from '../busCamera';
import { metres } from '../routeAhead';
import { busMapStyleUrl, isBusMapCamera, isBusMapStyle } from '../busMapOptions';

const stops = [
  { key: 'a', lat: 1, lng: 1, passed: true },
  { key: 'b', lat: 1, lng: 2, passed: false },
  { key: 'mine', lat: 1, lng: 3, passed: false },
  { key: 'school', lat: 1, lng: 4, passed: false },
];
const bus = { lat: 1, lng: 1.5 };

describe('cameraView', () => {
  it('follows the bus and our stop until the bus has been there', () => {
    expect(cameraView('follow', bus, stops, 'mine')).toEqual([[1.5, 1], [3, 1]]);
    const after = stops.map((s) => (s.key === 'school' ? s : { ...s, passed: true }));
    expect(cameraView('follow', bus, after, 'mine')).toEqual([[1.5, 1], [4, 1]]);
  });

  it('also frames the road ahead and a stretch past the bus the way it faces', () => {
    const road: [number, number][] = [[1.5, 1], [1.5, 1.2], [3, 1]];
    const view = cameraView('follow', { ...bus, heading: 0 }, stops, 'mine', road)!;
    expect(view).toEqual(expect.arrayContaining(road));
    const lead = view[view.length - 1]!;
    expect(lead[0]).toBeCloseTo(1.5, 6);
    expect(lead[1]).toBeGreaterThan(1);
    expect(metres([1.5, 1], lead)).toBeCloseTo(LEAD_M, 0);
  });

  it('brings the stop after into view once the bus is nearly at its stop', () => {
    const near = [
      { key: 'a', lat: 40, lng: -105, passed: true },
      { key: 'mine', lat: 40.002, lng: -105, passed: false },
      { key: 'next', lat: 40.002, lng: -104.99, passed: false },
    ];
    const far = { lat: 39.99, lng: -105 };
    const close = { lat: 40.0005, lng: -105 };
    expect(cameraView('follow', far, near, 'mine')).not.toContainEqual([-104.99, 40.002]);
    expect(cameraView('follow', close, near, 'mine')).toContainEqual([-104.99, 40.002]);
  });

  it('shows the whole route, with the bus, when asked or when there is nothing to follow', () => {
    expect(cameraView('route', bus, stops, 'mine')).toHaveLength(5);
    expect(cameraView('follow', null, stops, 'mine')).toHaveLength(4);
    expect(cameraView('follow', null, [], null)).toBeNull();
  });

});

describe('map options', () => {
  it('picks the dark variant of each style for a dark theme', () => {
    expect(busMapStyleUrl('simple', false)).toMatch(/positron$/);
    expect(busMapStyleUrl('simple', true)).toMatch(/dark$/);
    expect(busMapStyleUrl('detailed', true)).toMatch(/fiord$/);
  });

  it('accepts only known choices', () => {
    expect(isBusMapStyle('simple')).toBe(true);
    expect(isBusMapStyle('satellite')).toBe(false);
    expect(isBusMapCamera('route')).toBe(true);
    expect(isBusMapCamera('alternate')).toBe(false);
    expect(isBusMapCamera(1)).toBe(false);
  });
});

describe('needsReframe', () => {
  const box = { left: 20, top: 20, right: 380, bottom: 280 };
  it('leaves the camera alone while everything is in view', () => {
    expect(needsReframe([[100, 100], [300, 200]], box, 14, 14.6)).toBe(false);
  });
  it('moves when a point nears the edge, or a whole zoom level is to be had', () => {
    expect(needsReframe([[10, 100]], box, 14, 14)).toBe(true);
    expect(needsReframe([[100, 100]], box, 14, 15)).toBe(true);
  });
});
