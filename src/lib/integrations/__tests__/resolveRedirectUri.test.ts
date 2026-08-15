import { resolveRedirectUri } from '@/lib/integrations/resolveRedirectUri';

/** Minimal stand-in for the parts of Request that resolveRedirectUri reads. */
function req(url: string, headers: Record<string, string> = {}): Request {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    url,
    headers: { get: (k: string) => lower[k.toLowerCase()] ?? null },
  } as unknown as Request;
}

const CB = '/api/auth/google/callback';

describe('resolveRedirectUri', () => {
  const original = process.env.APP_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = original;
  });

  it('derives an https public host from forwarded headers (unchanged)', () => {
    process.env.APP_URL = 'https://elsewhere.example.com';
    const r = req('http://prism-app:3000/api/auth/google', {
      'x-forwarded-host': 'prism.example.com',
      'x-forwarded-proto': 'https',
    });
    // A valid public https origin is respected, not overridden by APP_URL —
    // this preserves the multi-host behaviour (#124).
    expect(resolveRedirectUri(r, CB)).toBe('https://prism.example.com/api/auth/google/callback');
  });

  it('falls back to APP_URL when reached directly on a private IP over http', () => {
    process.env.APP_URL = 'https://prism.example.com';
    const r = req('http://192.168.1.5:3000/api/auth/google', { host: '192.168.1.5:3000' });
    expect(resolveRedirectUri(r, CB)).toBe('https://prism.example.com/api/auth/google/callback');
  });

  it('falls back even when the private host is served over https', () => {
    process.env.APP_URL = 'https://prism.example.com';
    const r = req('http://10.0.0.4:3000/api/auth/google', {
      host: '10.0.0.4:3000',
      'x-forwarded-proto': 'https',
    });
    expect(resolveRedirectUri(r, CB)).toBe('https://prism.example.com/api/auth/google/callback');
  });

  it('keeps the derived value when APP_URL is unset', () => {
    delete process.env.APP_URL;
    const r = req('http://192.168.1.5:3000/api/auth/google', { host: '192.168.1.5:3000' });
    expect(resolveRedirectUri(r, CB)).toBe('http://192.168.1.5:3000/api/auth/google/callback');
  });

  it('keeps the derived value when APP_URL is itself non-public (dev localhost)', () => {
    process.env.APP_URL = 'http://localhost:3000';
    const r = req('http://192.168.1.5:3000/api/auth/google', { host: '192.168.1.5:3000' });
    expect(resolveRedirectUri(r, CB)).toBe('http://192.168.1.5:3000/api/auth/google/callback');
  });

  it('does not override a plain-http public host unless APP_URL is public https', () => {
    process.env.APP_URL = 'https://prism.example.com';
    // Public hostname but plain http (no TLS / no forwarded-proto) — providers
    // still need https, so the public fallback applies.
    const r = req('http://prism.example.org/api/auth/google', { host: 'prism.example.org' });
    expect(resolveRedirectUri(r, CB)).toBe('https://prism.example.com/api/auth/google/callback');
  });
});
