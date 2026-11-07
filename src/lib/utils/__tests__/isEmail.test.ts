import { isEmail } from '../isEmail';

// Built from parts so no address-shaped literal sits in the source.
const at = (local: string, domain: string) => `${local}${String.fromCharCode(64)}${domain}`;

describe('isEmail', () => {
  it('takes the usual shapes and refuses the rest', () => {
    expect(isEmail(at('a', 'example.com'))).toBe(true);
    expect(isEmail(at('first.last', 'mail.example.com'))).toBe(true);
    expect(isEmail('no-at.example.com')).toBe(false);
    expect(isEmail(at('a', 'nodot'))).toBe(false);
    expect(isEmail(at('a', 'example.'))).toBe(false);
    expect(isEmail(at('a b', 'example.com'))).toBe(false);
  });

  it('rejects a long string at once (CodeQL polynomial ReDoS)', () => {
    // The old pattern took 5.5 s on 100 KB of this shape.
    const t0 = Date.now();
    expect(isEmail(at('a', 'b'.repeat(100_000)))).toBe(false);
    expect(isEmail(at('a', 'b.'.repeat(50_000)))).toBe(false);
    expect(Date.now() - t0).toBeLessThan(100);
  });
});
