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

  it('extracts the token from the modern /photos/#TOKEN format', () => {
    // Format share.icloud.com short links redirect to (per 2026-05 testing).
    expect(parseICloudShareToken('https://www.icloud.com/photos/#0c3g0wuSampleToken'))
      .toBe('0c3g0wuSampleToken');
  });

  it('rejects unresolved share.icloud.com short links with a clear error', () => {
    // Short links must be resolved via resolveICloudShareUrl() first.
    expect(() => parseICloudShareToken('https://share.icloud.com/photos/0c3g0wuSampleToken'))
      .toThrow(/unresolved/i);
  });

  it('rejects the CloudKit signed-in /photos/#/sa,UUID/ format', () => {
    expect(() =>
      parseICloudShareToken('https://www.icloud.com/photos/#/sa,3CC4FC89-C04F-408E-A5CC-3B0F73E3E449/'),
    ).toThrow(/signed-in/i);
  });
});
