import { ALTERNATE_MS, CLOSE_ZOOM, alternatePhase, cameraView } from '../busCamera';
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
    expect(cameraView('follow', 0, bus, stops, 'mine')).toEqual({ kind: 'bounds', points: [[1.5, 1], [3, 1]] });
    const after = stops.map((s) => (s.key === 'school' ? s : { ...s, passed: true }));
    expect(cameraView('follow', 0, bus, after, 'mine')).toEqual({ kind: 'bounds', points: [[1.5, 1], [4, 1]] });
  });

  it('shows the whole route, with the bus, when asked or when there is nothing to follow', () => {
    expect(cameraView('route', 0, bus, stops, 'mine')).toMatchObject({ kind: 'bounds' });
    expect((cameraView('route', 0, bus, stops, 'mine') as { points: unknown[] }).points).toHaveLength(5);
    expect((cameraView('follow', 0, null, stops, 'mine') as { points: unknown[] }).points).toHaveLength(4);
    expect(cameraView('follow', 0, null, [], null)).toBeNull();
  });

  it('alternates a close-up on the bus with the whole route', () => {
    expect(alternatePhase(0)).toBe('close');
    expect(alternatePhase(ALTERNATE_MS)).toBe('overview');
    expect(cameraView('alternate', 0, bus, stops, 'mine')).toEqual({ kind: 'center', center: [1.5, 1], zoom: CLOSE_ZOOM });
    expect(cameraView('alternate', ALTERNATE_MS, bus, stops, 'mine')).toMatchObject({ kind: 'bounds' });
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
    expect(isBusMapCamera('alternate')).toBe(true);
    expect(isBusMapCamera(1)).toBe(false);
  });
});
