/**
 * Tests for computeZones and isOldFormat from useScreenSafeZones.
 *
 * These are pure functions exported from the module, so no renderHook needed.
 */

import {
  computeZones,
  DEFAULT_SCREENS,
  DEFAULT_SCREEN_SAFE_ZONES,
  type ScreenZoneConfig,
} from '../useScreenSafeZones';

describe('computeZones', () => {
  it('computes landscape zones for 1920x1080 (16:9) → 48 cols', () => {
    const screens: ScreenZoneConfig[] = [
      { name: '16:9', width: 1920, height: 1080, color: '#000' },
    ];

    const zones = computeZones(screens, 'landscape');

    expect(zones).toHaveLength(1);
    expect(zones[0]!.cols).toBe(48); // 1920 >= 1200
    expect(zones[0]!.rows).toBe(Math.min(Math.round(48 * 1080 / 1920), 50));
    expect(zones[0]!.name).toBe('16:9');
  });

  it('computes portrait zones by swapping width/height', () => {
    const screens: ScreenZoneConfig[] = [
      { name: '16:9', width: 1920, height: 1080, color: '#000' },
    ];

    // In portrait: width = min(1920,1080)=1080, height = max(1920,1080)=1920
    const zones = computeZones(screens, 'portrait');

    expect(zones[0]!.cols).toBe(36); // 1080 >= 996 but < 1200
    // rows = round(36 * 1920 / 1080) = round(64) = 64 (at the cap)
    expect(zones[0]!.rows).toBe(64);
  });

  it('uses 24 cols for screens 768-995px wide', () => {
    const screens: ScreenZoneConfig[] = [
      { name: 'narrow', width: 800, height: 600, color: '#000' },
    ];

    const zones = computeZones(screens, 'landscape');

    expect(zones[0]!.cols).toBe(24);
  });

  it('uses 12 cols for screens under 768px', () => {
    const screens: ScreenZoneConfig[] = [
      { name: 'mobile', width: 375, height: 667, color: '#000' },
    ];

    const zones = computeZones(screens, 'landscape');

    // landscape: w=667, h=375. 667 < 768, so 12 cols
    expect(zones[0]!.cols).toBe(12);
  });

  it('caps rows at 64', () => {
    // Very tall aspect ratio: 100x5000
    const screens: ScreenZoneConfig[] = [
      { name: 'tall', width: 100, height: 5000, color: '#000' },
    ];

    const zones = computeZones(screens, 'portrait');

    // portrait: w=100, h=5000. cols=12. rows = round(12 * 5000 / 100) = 600, capped at 64
    expect(zones[0]!.rows).toBe(64);
  });

  it('processes multiple screens', () => {
    const zones = computeZones(DEFAULT_SCREENS, 'landscape');

    expect(zones).toHaveLength(DEFAULT_SCREENS.length);
    zones.forEach(z => {
      expect(z.cols).toBeGreaterThanOrEqual(12);
      expect(z.cols).toBeLessThanOrEqual(48);
      expect(z.rows).toBeGreaterThan(0);
      expect(z.rows).toBeLessThanOrEqual(64);
    });
  });

  it('handles square aspect ratio', () => {
    const screens: ScreenZoneConfig[] = [
      { name: 'square', width: 1200, height: 1200, color: '#000' },
    ];

    const zones = computeZones(screens, 'landscape');

    // landscape: w=1200, h=1200. cols=48. rows = round(48 * 1200 / 1200) = 48
    expect(zones[0]!.cols).toBe(48);
    expect(zones[0]!.rows).toBe(48);
  });

  it('iPad 4:3 portrait gives correct breakpoint', () => {
    const screens: ScreenZoneConfig[] = [
      { name: 'iPad', width: 2048, height: 1536, color: '#22C55E' },
    ];

    const zones = computeZones(screens, 'portrait');

    // portrait: w=min(2048,1536)=1536, h=max(2048,1536)=2048
    expect(zones[0]!.cols).toBe(48); // 1536 >= 1200
    // rows = round(48 * 2048 / 1536) = round(64) = 64 (at the cap)
    expect(zones[0]!.rows).toBe(64);
  });
});

describe('DEFAULT_SCREEN_SAFE_ZONES', () => {
  it('has landscape and portrait zone arrays', () => {
    expect(DEFAULT_SCREEN_SAFE_ZONES.landscape).toBeInstanceOf(Array);
    expect(DEFAULT_SCREEN_SAFE_ZONES.portrait).toBeInstanceOf(Array);
    expect(DEFAULT_SCREEN_SAFE_ZONES.landscape.length).toBe(DEFAULT_SCREENS.length);
    expect(DEFAULT_SCREEN_SAFE_ZONES.portrait.length).toBe(DEFAULT_SCREENS.length);
  });

  it('all default landscape zones use 48 cols (all screens >= 1200px)', () => {
    DEFAULT_SCREEN_SAFE_ZONES.landscape.forEach(z => {
      expect(z.cols).toBe(48);
    });
  });
});
