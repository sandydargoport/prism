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
