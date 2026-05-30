import { parseICloudShareToken } from '../icloud-shared';

describe('parseICloudShareToken', () => {
  it('extracts the token from a /sharedalbum/# URL', () => {
    expect(parseICloudShareToken('https://www.icloud.com/sharedalbum/#B1aXyZsample')).toBe('B1aXyZsample');
  });

  it('extracts the token from a /photostream/# URL (legacy)', () => {
    expect(parseICloudShareToken('https://www.icloud.com/photostream/#B0AaBbCcsample')).toBe('B0AaBbCcsample');
  });

  it('treats a raw token (no protocol) as the token itself', () => {
    expect(parseICloudShareToken('B1aXyZraw')).toBe('B1aXyZraw');
  });

  it('strips a leading # on a raw token', () => {
    expect(parseICloudShareToken('#B1aXyZraw')).toBe('B1aXyZraw');
  });

  it('trims whitespace from a pasted URL', () => {
    expect(parseICloudShareToken('   https://www.icloud.com/sharedalbum/#B1aXyZsample   '))
      .toBe('B1aXyZsample');
  });

  it('throws on an http URL missing the hash fragment', () => {
    expect(() => parseICloudShareToken('https://www.icloud.com/sharedalbum/')).toThrow(/missing/i);
  });

  it('throws on an empty token after #', () => {
    expect(() => parseICloudShareToken('https://www.icloud.com/sharedalbum/#')).toThrow(/empty/i);
  });
});
