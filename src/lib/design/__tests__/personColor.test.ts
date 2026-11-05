/**
 * Person colours at two strengths (#932).
 */
import { contrastRatioHex } from '@/lib/utils/color';
import { FAMILY_COLOR, MEMBER_COLORS } from '@/lib/constants/memberColors';
import { PERSON_GROUNDS, personColor } from '../personColor';

describe('personColor', () => {
  it.each([...MEMBER_COLORS, FAMILY_COLOR])('%s reaches 3:1 as a mark on a photo and on paper', (c) => {
    expect(contrastRatioHex(personColor(c, 'photo'), PERSON_GROUNDS.photo)).toBeGreaterThanOrEqual(3);
    expect(contrastRatioHex(personColor(c, 'paper'), PERSON_GROUNDS.paper)).toBeGreaterThanOrEqual(3);
  });
  it('is paler on a photo than on paper', () => {
    const lum = (hex: string) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);
    expect(lum(personColor('#3B82F6', 'photo'))).toBeGreaterThan(lum(personColor('#3B82F6', 'paper')));
  });
  it('makes Family coral by default', () => {
    expect(FAMILY_COLOR).toBe('#FF7D68');
  });
});
