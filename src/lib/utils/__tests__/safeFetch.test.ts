/**
 * Tests for the outbound URL validator (SSRF guard).
 *
 * Each blocked range gets a representative case. The dev/prod toggle
 * is exercised explicitly via the isProduction option so we don't
 * have to mutate process.env mid-suite.
 */

export {};

import { validatePublicUrl, safeFetch, parseAllowedInternalHosts, UnsafeUrlError } from '../safeFetch';

describe('validatePublicUrl', () => {
  it('accepts a public https URL', () => {
    const url = validatePublicUrl('https://example.com/foo', { isProduction: true });
    expect(url.hostname).toBe('example.com');
    expect(url.protocol).toBe('https:');
  });

  it('accepts a public http URL', () => {
    const url = validatePublicUrl('http://api.openweathermap.org/data', { isProduction: true });
    expect(url.hostname).toBe('api.openweathermap.org');
  });

  it('rejects empty input', () => {
    expect(() => validatePublicUrl('', { isProduction: true })).toThrow(UnsafeUrlError);
  });

  it('rejects unparseable input', () => {
    expect(() => validatePublicUrl('not a url', { isProduction: true })).toThrow(UnsafeUrlError);
  });

  it('rejects javascript: protocol', () => {
    expect(() => validatePublicUrl('javascript:alert(1)', { isProduction: true })).toThrow(/protocol/i);
  });

  it('rejects file: protocol', () => {
    expect(() => validatePublicUrl('file:///etc/passwd', { isProduction: true })).toThrow(/protocol/i);
  });

  it('rejects ftp: protocol', () => {
    expect(() => validatePublicUrl('ftp://example.com/foo', { isProduction: true })).toThrow(/protocol/i);
  });

  describe('IPv4 private ranges (in production)', () => {
    const cases = [
      ['127.0.0.1', 'loopback'],
      ['127.5.5.5', 'loopback /8'],
      ['10.0.0.1', '10/8'],
      ['10.255.255.255', '10/8 upper'],
      ['172.16.0.1', '172.16/12 lower'],
      ['172.31.255.255', '172.16/12 upper'],
      ['192.168.1.1', '192.168/16'],
      ['169.254.169.254', 'cloud metadata'],
      ['169.254.0.1', 'link-local'],
      ['0.0.0.0', 'this network'],
      ['100.64.0.1', 'CGNAT lower'],
      ['100.127.255.255', 'CGNAT upper'],
    ];
    for (const [host, label] of cases) {
      it(`rejects ${host} (${label})`, () => {
        expect(() => validatePublicUrl(`http://${host}/`, { isProduction: true }))
          .toThrow(UnsafeUrlError);
      });
    }
  });

  describe('IPv4 public ranges accepted in production', () => {
    const cases = [
      '8.8.8.8',
      '1.1.1.1',
      '172.15.0.1',  // just below 172.16
      '172.32.0.1',  // just above 172.31
      '192.169.0.1', // just past 192.168
      '169.255.0.1', // just past 169.254
      '100.63.0.1',  // just below CGNAT
      '100.128.0.1', // just past CGNAT
    ];
    for (const host of cases) {
      it(`accepts ${host}`, () => {
        const url = validatePublicUrl(`http://${host}/`, { isProduction: true });
        expect(url.hostname).toBe(host);
      });
    }
  });

  describe('IPv6 private ranges (in production)', () => {
    const cases = [
      ['[::1]', 'loopback'],
      ['[::]', 'unspecified'],
      ['[fc00::1]', 'ULA fc'],
      ['[fd00::1]', 'ULA fd'],
      ['[fe80::1]', 'link-local'],
      ['[::ffff:127.0.0.1]', 'IPv4-mapped loopback'],
      ['[::ffff:10.0.0.1]', 'IPv4-mapped 10/8'],
    ];
    for (const [host, label] of cases) {
      it(`rejects ${host} (${label})`, () => {
        expect(() => validatePublicUrl(`http://${host}/`, { isProduction: true }))
          .toThrow(UnsafeUrlError);
      });
    }
  });

  describe('IPv6 public ranges accepted in production', () => {
    it('accepts a public IPv6 literal', () => {
      const url = validatePublicUrl('http://[2606:4700:4700::1111]/', { isProduction: true });
      expect(url.hostname).toBe('[2606:4700:4700::1111]');
    });
  });

  describe('localhost handling', () => {
    it('rejects localhost in production', () => {
      expect(() => validatePublicUrl('http://localhost/', { isProduction: true }))
        .toThrow(UnsafeUrlError);
    });
    it('rejects subdomain.localhost in production', () => {
      expect(() => validatePublicUrl('http://api.localhost/', { isProduction: true }))
        .toThrow(UnsafeUrlError);
    });
    it('accepts localhost in non-production', () => {
      const url = validatePublicUrl('http://localhost:3000/', { isProduction: false });
      expect(url.hostname).toBe('localhost');
    });
    it('accepts 127.0.0.1 in non-production', () => {
      const url = validatePublicUrl('http://127.0.0.1:3000/', { isProduction: false });
      expect(url.hostname).toBe('127.0.0.1');
    });
    it('still rejects non-loopback private IPs in non-production', () => {
      expect(() => validatePublicUrl('http://10.0.0.1/', { isProduction: false }))
        .toThrow(UnsafeUrlError);
    });
  });
});

describe('validatePublicUrl — PRISM_ALLOWED_INTERNAL_HOSTS allowlist', () => {
  it('permits an allowlisted private IP in production', () => {
    const url = validatePublicUrl('http://192.168.50.60:8082/api/recipe/', {
      isProduction: true,
      allowedInternalHosts: ['192.168.50.60'],
    });
    expect(url.hostname).toBe('192.168.50.60');
  });

  it('permits an allowlisted bare hostname in production', () => {
    const url = validatePublicUrl('http://docker-host:8082/api', {
      isProduction: true,
      allowedInternalHosts: ['docker-host'],
    });
    expect(url.hostname).toBe('docker-host');
  });

  it('permits a private IP inside an allowlisted CIDR range', () => {
    const url = validatePublicUrl('http://10.1.2.3/x', {
      isProduction: true,
      allowedInternalHosts: ['10.0.0.0/8'],
    });
    expect(url.hostname).toBe('10.1.2.3');
  });

  it('permits an allowlisted IPv6 loopback (bracket-insensitive)', () => {
    const url = validatePublicUrl('http://[::1]:8082/', {
      isProduction: true,
      allowedInternalHosts: ['::1'],
    });
    expect(url.hostname).toBe('[::1]');
  });

  it('still rejects a private host that is NOT on the allowlist', () => {
    expect(() =>
      validatePublicUrl('http://192.168.1.99/', {
        isProduction: true,
        allowedInternalHosts: ['192.168.50.60'],
      }),
    ).toThrow(UnsafeUrlError);
  });

  it('rejects an out-of-range IP even when a CIDR is allowlisted', () => {
    expect(() =>
      validatePublicUrl('http://172.16.5.5/', {
        isProduction: true,
        allowedInternalHosts: ['192.168.0.0/16'],
      }),
    ).toThrow(UnsafeUrlError);
  });

  it('the block error is actionable — names the host and the env var', () => {
    try {
      validatePublicUrl('http://192.168.1.99/', { isProduction: true, allowedInternalHosts: [] });
      throw new Error('expected validatePublicUrl to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(UnsafeUrlError);
      expect((e as Error).message).toContain('192.168.1.99');
      expect((e as Error).message).toContain('PRISM_ALLOWED_INTERNAL_HOSTS');
      expect((e as Error).message).toMatch(/\.env/);
    }
  });

  it('empty allowlist preserves strict behavior', () => {
    expect(() =>
      validatePublicUrl('http://10.0.0.1/', { isProduction: true, allowedInternalHosts: [] }),
    ).toThrow(UnsafeUrlError);
  });
});

describe('parseAllowedInternalHosts', () => {
  const expected = ['192.168.50.60', 'docker-host', '10.0.0.0/8'];
  it('accepts comma-separated entries', () => {
    expect(parseAllowedInternalHosts(' 192.168.50.60, docker-host ,10.0.0.0/8 ')).toEqual(expected);
  });
  it('accepts space-separated entries', () => {
    expect(parseAllowedInternalHosts('192.168.50.60 docker-host 10.0.0.0/8')).toEqual(expected);
  });
  it('accepts newline-separated entries (multiline .env value)', () => {
    expect(parseAllowedInternalHosts('192.168.50.60\ndocker-host\n10.0.0.0/8')).toEqual(expected);
  });
  it('returns an empty list for empty / undefined input', () => {
    expect(parseAllowedInternalHosts(undefined)).toEqual([]);
    expect(parseAllowedInternalHosts('')).toEqual([]);
    expect(parseAllowedInternalHosts('  ,  ')).toEqual([]);
  });
});

describe('safeFetch (redirect re-validation)', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  /** A minimal 3xx redirect response carrying a Location header. */
  function redirect(status: number, location: string): Partial<Response> {
    return { status, headers: new Headers({ location }) };
  }
  /** A terminal 200 response. */
  function ok(): Partial<Response> {
    return { ok: true, status: 200, headers: new Headers(), text: () => Promise.resolve('body') };
  }

  it('fetches a public URL with redirect:manual and returns the response', async () => {
    const fetchMock = jest.fn().mockResolvedValue(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await safeFetch('https://example.com/api', { headers: { X: '1' } }, { isProduction: true });

    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.com/api');
    expect(init.redirect).toBe('manual');
    expect(init.headers).toEqual({ X: '1' });
  });

  it('rejects the initial URL when it is private (never calls fetch)', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      safeFetch('http://169.254.169.254/latest/meta-data', {}, { isProduction: true }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('follows a redirect to another public host', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(redirect(302, 'https://cdn.example.net/asset'))
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await safeFetch('https://example.com/asset', {}, { isProduction: true });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://cdn.example.net/asset');
  });

  it('blocks a redirect whose Location points at a private host (the core SSRF bypass)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(redirect(302, 'http://169.254.169.254/latest/meta-data'));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      safeFetch('https://public-decoy.example.com/img', {}, { isProduction: true }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    // The internal target is never fetched — only the first (public) hop ran.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks a redirect to loopback', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(redirect(307, 'http://127.0.0.1:2283/api/assets'));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      safeFetch('https://public.example.com/x', {}, { isProduction: true }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves and validates a relative Location against the current URL', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(redirect(302, '/moved/here'))
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    await safeFetch('https://example.com/start', {}, { isProduction: true });

    expect(fetchMock.mock.calls[1][0]).toBe('https://example.com/moved/here');
  });

  it('downgrades POST to GET and drops the body on a 303', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(redirect(303, 'https://example.com/result'))
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    await safeFetch(
      'https://example.com/submit',
      { method: 'POST', body: JSON.stringify({ a: 1 }) },
      { isProduction: true },
    );

    const secondInit = fetchMock.mock.calls[1][1];
    expect(secondInit.method).toBe('GET');
    expect(secondInit.body).toBeUndefined();
  });

  it('preserves method and body across a 308', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(redirect(308, 'https://example.com/v2/submit'))
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    await safeFetch(
      'https://example.com/submit',
      { method: 'POST', body: 'payload' },
      { isProduction: true },
    );

    const secondInit = fetchMock.mock.calls[1][1];
    expect(secondInit.method).toBe('POST');
    expect(secondInit.body).toBe('payload');
  });

  it('throws after exceeding maxRedirects instead of looping forever', async () => {
    const fetchMock = jest.fn().mockResolvedValue(redirect(302, 'https://example.com/loop'));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      safeFetch('https://example.com/loop', {}, { isProduction: true, maxRedirects: 3 }),
    ).rejects.toThrow(/Too many redirects/);
    // Initial hop + 3 followed redirects = 4 fetch calls, then it gives up.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('returns a redirect status unchanged when it carries no Location', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ status: 302, headers: new Headers() });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await safeFetch('https://example.com/weird', {}, { isProduction: true });
    expect(res.status).toBe(302);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
