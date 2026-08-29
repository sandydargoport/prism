/**
 * Whether Google's browser sign-in can work from a given address.
 *
 * Getting this wrong in the permissive direction is what produces the dead end
 * this exists to avoid: a Connect button that sends the user to Google, which
 * refuses in its own words with nothing on the Prism side explaining why.
 */
import { browserOAuthUsable } from '../googleRedirectSupport';

describe('browserOAuthUsable', () => {
  it('accepts a public https domain', () => {
    expect(browserOAuthUsable('https://prism.example.com')).toBe(true);
    expect(browserOAuthUsable('https://prism.example.com:8443')).toBe(true);
  });

  it('accepts loopback over http, which is Google’s one exception', () => {
    expect(browserOAuthUsable('http://localhost:8091')).toBe(true);
    expect(browserOAuthUsable('http://127.0.0.1:3000')).toBe(true);
  });

  it('rejects a private LAN address', () => {
    // The common home install, and the first thing that failed in testing.
    expect(browserOAuthUsable('http://192.168.50.10:3000')).toBe(false);
    expect(browserOAuthUsable('http://10.0.0.5:3000')).toBe(false);
  });

  it('rejects a Tailscale address', () => {
    expect(browserOAuthUsable('http://100.115.92.7:8091')).toBe(false);
  });

  it('rejects a bare IP even over https', () => {
    // Google wants a domain, not an address, whatever the scheme.
    expect(browserOAuthUsable('https://192.168.50.10')).toBe(false);
  });

  it('rejects .local and friends', () => {
    expect(browserOAuthUsable('http://homeassistant.local:8123')).toBe(false);
    expect(browserOAuthUsable('https://prism.local')).toBe(false);
    expect(browserOAuthUsable('https://prism.internal')).toBe(false);
  });

  it('rejects a single-label host with no dot at all', () => {
    expect(browserOAuthUsable('https://prism')).toBe(false);
  });

  it('rejects http on a public domain, since Google requires TLS', () => {
    expect(browserOAuthUsable('http://prism.example.com')).toBe(false);
  });

  it('treats anything unparseable or absent as unusable', () => {
    // Conservative on purpose: steer to the flow that always works.
    expect(browserOAuthUsable('not a url')).toBe(false);
    expect(browserOAuthUsable('')).toBe(false);
    expect(browserOAuthUsable(null)).toBe(false);
    expect(browserOAuthUsable(undefined)).toBe(false);
  });
});
