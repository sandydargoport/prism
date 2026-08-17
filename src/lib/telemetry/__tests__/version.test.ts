/**
 * Tests for the update-check version helpers: ordering, and the deliberate
 * suppression of patch-only bumps so the dashboard never nags on hotfixes.
 */
import { compareVersions, isNotifiableUpdate } from '../version';

describe('compareVersions', () => {
  it('orders major/minor/patch correctly', () => {
    expect(compareVersions('1.14.2', '1.14.1')).toBe(1);
    expect(compareVersions('1.14.1', '1.14.2')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('1.14.2', '1.14.2')).toBe(0);
  });

  it('tolerates a leading v and uneven segment counts', () => {
    expect(compareVersions('v1.15.0', '1.14.2')).toBe(1);
    expect(compareVersions('1.14', '1.14.0')).toBe(0);
    expect(compareVersions('1.14.0.0', '1.14')).toBe(0);
  });
});

describe('isNotifiableUpdate', () => {
  it('notifies on a newer minor or major', () => {
    expect(isNotifiableUpdate('1.14.2', '1.15.0')).toBe(true);
    expect(isNotifiableUpdate('1.14.2', '2.0.0')).toBe(true);
  });

  it('stays silent on patch-only bumps', () => {
    expect(isNotifiableUpdate('1.14.2', '1.14.9')).toBe(false);
    expect(isNotifiableUpdate('1.14.0', '1.14.1')).toBe(false);
  });

  it('stays silent when up to date, ahead, or latest is unknown', () => {
    expect(isNotifiableUpdate('1.14.2', '1.14.2')).toBe(false);
    expect(isNotifiableUpdate('1.15.0', '1.14.2')).toBe(false);
    expect(isNotifiableUpdate('1.14.2', undefined)).toBe(false);
  });
});
