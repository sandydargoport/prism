/**
 * Tests for the Immich shared-link client.
 *
 * Covers URL parsing, the public/password-protected login flows, the typed
 * error mapping for the various 401/404 cases, and asset download (with and
 * without password — the password path requires a login round trip first to
 * pick up the session cookie).
 */

jest.mock('sharp', () => {
  const toBuffer = jest.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]));
  const jpeg = jest.fn().mockReturnValue({ toBuffer });
  const rotate = jest.fn().mockReturnValue({ jpeg });
  const sharpFn = jest.fn().mockReturnValue({ rotate, jpeg, toBuffer });
  return { __esModule: true, default: sharpFn };
});

// The DNS check safeFetch runs in production. Only the SSRF cases below run
// as production, and they set what each name resolves to.
const mockLookup = jest.fn();
jest.mock('node:dns/promises', () => ({ lookup: (...args: unknown[]) => mockLookup(...args) }));

import {
  parseImmichShareUrl,
  fetchSharedLink,
  downloadImmichAsset,
  ImmichPasswordRequiredError,
  ImmichInvalidPasswordError,
  ImmichShareNotFoundError,
  UnsafeUrlError,
  _clearImmichCookieCache,
} from '../immich';

afterEach(() => {
  jest.clearAllMocks();
  _clearImmichCookieCache();
});

function mockFetchOnce(impl: () => Partial<Response> | Promise<Partial<Response>>) {
  global.fetch = jest.fn().mockImplementationOnce(impl);
}

function mockFetchSequence(impls: Array<() => Partial<Response> | Promise<Partial<Response>>>) {
  const fn = jest.fn();
  for (const impl of impls) fn.mockImplementationOnce(impl);
  global.fetch = fn;
}

describe('parseImmichShareUrl', () => {
  it('extracts server and key from a typical share URL', () => {
    const result = parseImmichShareUrl('https://immich.example.com/share/abc123');
    expect(result).toEqual({ serverUrl: 'https://immich.example.com', shareKey: 'abc123' });
  });

  it('ignores trailing path segments after the key', () => {
    const result = parseImmichShareUrl('https://immich.example.com/share/abc123/photos');
    expect(result.shareKey).toBe('abc123');
  });

  it('preserves a subpath deployment in serverUrl', () => {
    const result = parseImmichShareUrl('https://example.com/photos/share/xyz');
    expect(result).toEqual({ serverUrl: 'https://example.com/photos', shareKey: 'xyz' });
  });

  it('throws on a URL with no /share/ segment', () => {
    expect(() => parseImmichShareUrl('https://immich.example.com/album/abc123')).toThrow(
      /must contain \/share\//,
    );
  });

  it('throws on an empty string', () => {
    expect(() => parseImmichShareUrl('')).toThrow(/required/);
  });

  it('throws on an unparseable URL', () => {
    expect(() => parseImmichShareUrl('not a url')).toThrow(/Invalid Immich share URL/);
  });
});

describe('fetchSharedLink (public)', () => {
  it('GETs /shared-links/me with the key and maps assets', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () =>
        Promise.resolve({
          album: { id: 'album-1', albumName: 'Vacation' },
          allowDownload: true,
          password: null,
          assets: [
            {
              id: 'a1',
              originalFileName: 'IMG.jpg',
              originalMimeType: 'image/jpeg',
              type: 'IMAGE',
              fileCreatedAt: '2025-01-01T00:00:00.000Z',
              width: 4032,
              height: 3024,
              exifInfo: { latitude: 37.7749, longitude: -122.4194 },
            },
          ],
        }),
    }));

    const link = await fetchSharedLink({ serverUrl: 'https://immich.example.com', shareKey: 'k' });

    const fetchUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(fetchUrl).toBe('https://immich.example.com/api/shared-links/me?key=k');

    expect(link.albumId).toBe('album-1');
    expect(link.hasPassword).toBe(false);
    expect(link.assets).toHaveLength(1);
    expect(link.assets[0]).toMatchObject({
      id: 'a1',
      originalMimeType: 'image/jpeg',
      latitude: 37.7749,
      longitude: -122.4194,
    });
  });

  it('throws ImmichPasswordRequiredError on 401', async () => {
    mockFetchOnce(() => ({ ok: false, status: 401, headers: new Headers() }));
    await expect(
      fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k' }),
    ).rejects.toBeInstanceOf(ImmichPasswordRequiredError);
  });

  it('throws ImmichShareNotFoundError on 404', async () => {
    mockFetchOnce(() => ({ ok: false, status: 404, headers: new Headers() }));
    await expect(
      fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k' }),
    ).rejects.toBeInstanceOf(ImmichShareNotFoundError);
  });

  it('exposes hasPassword=false when password field is null', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ password: null, assets: [] }),
    }));
    const link = await fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k' });
    expect(link.hasPassword).toBe(false);
  });

  it('exposes hasPassword=true when password field is non-null', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ password: 'bcrypt-hash', assets: [] }),
    }));
    const link = await fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k' });
    expect(link.hasPassword).toBe(true);
  });
});

describe('fetchSharedLink (ALBUM-type follow-up)', () => {
  it('follows up with search/metadata when share type is ALBUM (Immich v3 serves album assets there)', async () => {
    mockFetchSequence([
      // /shared-links/me — ALBUM-type shares return album metadata only, no assets.
      () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            type: 'ALBUM',
            album: { id: 'album-uuid', albumName: 'Cats' },
            allowDownload: true,
            password: null,
            assets: [],
          }),
      }),
      // /search/metadata — the actual asset list, in the paginated envelope.
      () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            albums: { total: 0, count: 0, items: [] },
            assets: {
              total: 1,
              count: 1,
              nextPage: null,
              items: [
                {
                  id: 'a1',
                  originalFileName: 'kitten.jpg',
                  originalMimeType: 'image/jpeg',
                  type: 'IMAGE',
                  fileCreatedAt: '2025-06-01T00:00:00.000Z',
                  width: 1920,
                  height: 1080,
                  exifInfo: { latitude: null, longitude: null },
                },
              ],
            },
          }),
      }),
    ]);

    const link = await fetchSharedLink({ serverUrl: 'https://im', shareKey: 'k' });

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe('https://im/api/shared-links/me?key=k');
    expect(calls[1][0]).toBe('https://im/api/search/metadata?key=k');
    // The album id is sent as a search filter in the POST body.
    expect(calls[1][1].method).toBe('POST');
    expect(JSON.parse(calls[1][1].body)).toMatchObject({ albumIds: ['album-uuid'] });

    expect(link.albumId).toBe('album-uuid');
    expect(link.assets).toHaveLength(1);
    expect(link.assets[0]).toMatchObject({ id: 'a1', originalFileName: 'kitten.jpg' });
  });

  it('paginates search/metadata via nextPage until it is null', async () => {
    const makeAsset = (id: string) => ({
      id,
      originalFileName: `${id}.jpg`,
      originalMimeType: 'image/jpeg',
      type: 'IMAGE',
      fileCreatedAt: '2025-06-01T00:00:00.000Z',
      width: 1,
      height: 1,
      exifInfo: { latitude: null, longitude: null },
    });
    mockFetchSequence([
      () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          Promise.resolve({
            type: 'ALBUM',
            album: { id: 'album-uuid', albumName: 'Big' },
            password: null,
            assets: [],
          }),
      }),
      // page 1 -> nextPage 2
      () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ assets: { nextPage: '2', items: [makeAsset('a1')] } }),
      }),
      // page 2 -> nextPage null (last page)
      () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ assets: { nextPage: null, items: [makeAsset('a2')] } }),
      }),
    ]);

    const link = await fetchSharedLink({ serverUrl: 'https://im', shareKey: 'k' });

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls).toHaveLength(3);
    expect(JSON.parse(calls[1][1].body)).toMatchObject({ page: 1 });
    expect(JSON.parse(calls[2][1].body)).toMatchObject({ page: 2 });
    expect(link.assets.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('forwards the login session cookie on the album request for password-protected ALBUM shares', async () => {
    const loginHeaders = new Headers();
    loginHeaders.append('set-cookie', 'immich_shared_link_token=abc; Path=/; HttpOnly');

    mockFetchSequence([
      () => ({
        ok: true,
        status: 201,
        headers: loginHeaders,
        json: () =>
          Promise.resolve({
            type: 'ALBUM',
            album: { id: 'album-uuid' },
            password: 'hash',
            assets: [],
          }),
      }),
      () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ assets: { nextPage: null, items: [] } }),
      }),
    ]);

    await fetchSharedLink({ serverUrl: 'https://im', shareKey: 'k', password: 'pw' });

    const albumCall = (global.fetch as jest.Mock).mock.calls[1];
    expect(albumCall[0]).toBe('https://im/api/search/metadata?key=k');
    expect(albumCall[1].headers.Cookie).toContain('immich_shared_link_token=abc');
  });

  it('skips the follow-up call for INDIVIDUAL-type shares (assets are inline)', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () =>
        Promise.resolve({
          type: 'INDIVIDUAL',
          album: null,
          password: null,
          assets: [
            {
              id: 'a1',
              originalFileName: 'one.jpg',
              originalMimeType: 'image/jpeg',
              type: 'IMAGE',
              fileCreatedAt: '2025-01-01T00:00:00.000Z',
              exifInfo: null,
            },
          ],
        }),
    }));

    const link = await fetchSharedLink({ serverUrl: 'https://im', shareKey: 'k' });

    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
    expect(link.assets).toHaveLength(1);
  });
});

describe('fetchSharedLink (password-protected)', () => {
  it('POSTs to /shared-links/login with the password as JSON body', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 201,
      headers: new Headers(),
      json: () => Promise.resolve({ password: 'hash', assets: [] }),
    }));

    await fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k', password: 'pw' });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://x/api/shared-links/login?key=k');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ password: 'pw' });
  });

  it('throws ImmichInvalidPasswordError on 401 from login', async () => {
    mockFetchOnce(() => ({ ok: false, status: 401, headers: new Headers() }));
    await expect(
      fetchSharedLink({ serverUrl: 'https://x', shareKey: 'k', password: 'wrong' }),
    ).rejects.toBeInstanceOf(ImmichInvalidPasswordError);
  });

  it('throws ImmichShareNotFoundError on 404 from login', async () => {
    mockFetchOnce(() => ({ ok: false, status: 404, headers: new Headers() }));
    await expect(
      fetchSharedLink({ serverUrl: 'https://x', shareKey: 'gone', password: 'pw' }),
    ).rejects.toBeInstanceOf(ImmichShareNotFoundError);
  });
});

describe('downloadImmichAsset', () => {
  it('downloads a web-safe fullsize thumbnail, not /original', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8]).buffer),
    }));

    const result = await downloadImmichAsset(
      { serverUrl: 'https://x', shareKey: 'k' },
      'asset-1',
    );

    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toBe('https://x/api/assets/asset-1/thumbnail?key=k&size=fullsize');
    expect(result.contentType).toBe('image/jpeg');
    expect(result.buffer).toBeInstanceOf(Uint8Array);
  });

  it('falls back to preview when fullsize is unavailable', async () => {
    mockFetchSequence([
      () => ({ ok: false, status: 404, statusText: 'Not Found' }),
      () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/webp' }),
        arrayBuffer: () => Promise.resolve(new Uint8Array([0x52, 0x49]).buffer),
      }),
    ]);

    const result = await downloadImmichAsset(
      { serverUrl: 'https://x', shareKey: 'k' },
      'asset-1',
    );

    const urls = (global.fetch as jest.Mock).mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      'https://x/api/assets/asset-1/thumbnail?key=k&size=fullsize',
      'https://x/api/assets/asset-1/thumbnail?key=k&size=preview',
    ]);
    expect(result.contentType).toBe('image/webp');
  });

  it('converts leftover HEIC bytes to JPEG', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/heic' }),
      arrayBuffer: () => Promise.resolve(new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]).buffer),
    }));

    const result = await downloadImmichAsset(
      { serverUrl: 'https://x', shareKey: 'k' },
      'asset-1',
    );

    expect(result.contentType).toBe('image/jpeg');
    expect(Buffer.from(result.buffer).subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))).toBe(true);
  });

  it('downloads the thumbnail when thumb=true', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/webp' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
    }));

    await downloadImmichAsset(
      { serverUrl: 'https://x', shareKey: 'k' },
      'asset-1',
      { thumb: true },
    );

    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toBe('https://x/api/assets/asset-1/thumbnail?key=k&size=preview');
  });

  it('logs in first when password is provided and forwards Set-Cookie', async () => {
    const loginHeaders = new Headers();
    loginHeaders.append('set-cookie', 'immich_auth=session-token; Path=/; HttpOnly');

    mockFetchSequence([
      () => ({
        ok: true,
        status: 201,
        headers: loginHeaders,
        json: () => Promise.resolve({ password: 'hash', assets: [] }),
      }),
      () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)),
      }),
    ]);

    await downloadImmichAsset(
      { serverUrl: 'https://x', shareKey: 'k', password: 'pw' },
      'asset-1',
    );

    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
    const [, downloadInit] = (global.fetch as jest.Mock).mock.calls[1];
    expect(downloadInit.headers.Cookie).toContain('immich_auth=session-token');
  });

  it('throws on a non-OK download response', async () => {
    mockFetchOnce(() => ({ ok: false, status: 500, statusText: 'Internal Server Error' }));
    await expect(
      downloadImmichAsset({ serverUrl: 'https://x', shareKey: 'k' }, 'asset-1'),
    ).rejects.toThrow(/Failed to download Immich asset/);
  });
});

describe('downloadImmichAsset cookie cache (password-protected, with sourceId)', () => {
  it('reuses the cached cookie and skips the login call on the second download', async () => {
    const loginHeaders = new Headers();
    loginHeaders.append('set-cookie', 'immich_auth=cached-token; Path=/; HttpOnly');

    // First download: login + download = 2 calls.
    mockFetchSequence([
      () => ({
        ok: true,
        status: 201,
        headers: loginHeaders,
        json: () => Promise.resolve({ password: 'hash', assets: [] }),
      }),
      () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)),
      }),
      // Second download: cookie should be reused, only the download call.
      () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(3)),
      }),
    ]);

    const creds = { serverUrl: 'https://x', shareKey: 'k', password: 'pw', sourceId: 'src-1' };
    await downloadImmichAsset(creds, 'asset-1');
    await downloadImmichAsset(creds, 'asset-2');

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls).toHaveLength(3);
    // First call is the login.
    expect(calls[0][0]).toBe('https://x/api/shared-links/login?key=k');
    // Second and third are downloads, both carrying the cached cookie.
    expect(calls[1][0]).toContain('/api/assets/asset-1/thumbnail?key=k&size=fullsize');
    expect(calls[1][1].headers.Cookie).toContain('immich_auth=cached-token');
    expect(calls[2][0]).toContain('/api/assets/asset-2/thumbnail?key=k&size=fullsize');
    expect(calls[2][1].headers.Cookie).toContain('immich_auth=cached-token');
  });

  it('does not cache when sourceId is omitted (every call re-logs in)', async () => {
    const loginHeaders = new Headers();
    loginHeaders.append('set-cookie', 'immich_auth=t1; Path=/; HttpOnly');

    mockFetchSequence([
      () => ({ ok: true, status: 201, headers: loginHeaders, json: () => Promise.resolve({ assets: [] }) }),
      () => ({ ok: true, status: 200, headers: new Headers(), arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)) }),
      () => ({ ok: true, status: 201, headers: loginHeaders, json: () => Promise.resolve({ assets: [] }) }),
      () => ({ ok: true, status: 200, headers: new Headers(), arrayBuffer: () => Promise.resolve(new ArrayBuffer(3)) }),
    ]);

    const creds = { serverUrl: 'https://x', shareKey: 'k', password: 'pw' };
    await downloadImmichAsset(creds, 'asset-1');
    await downloadImmichAsset(creds, 'asset-2');

    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(4);
  });

  it('drops the cached cookie on a 401 download response so the next call re-logs in', async () => {
    const loginHeaders = new Headers();
    loginHeaders.append('set-cookie', 'immich_auth=stale; Path=/; HttpOnly');

    mockFetchSequence([
      () => ({ ok: true, status: 201, headers: loginHeaders, json: () => Promise.resolve({ assets: [] }) }),
      // Download fails with 401: cache should be invalidated.
      () => ({ ok: false, status: 401, statusText: 'Unauthorized' }),
      // Next call: fresh login + download.
      () => ({ ok: true, status: 201, headers: loginHeaders, json: () => Promise.resolve({ assets: [] }) }),
      () => ({ ok: true, status: 200, headers: new Headers(), arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)) }),
    ]);

    const creds = { serverUrl: 'https://x', shareKey: 'k', password: 'pw', sourceId: 'src-2' };
    await expect(downloadImmichAsset(creds, 'asset-1')).rejects.toThrow();
    await downloadImmichAsset(creds, 'asset-2');

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[2][0]).toBe('https://x/api/shared-links/login?key=k');
  });

  it('seeds the cache from a fetchSharedLink login so a later download skips re-login', async () => {
    const loginHeaders = new Headers();
    loginHeaders.append('set-cookie', 'immich_auth=from-sync; Path=/; HttpOnly');

    mockFetchSequence([
      // fetchSharedLink with password = login + (no follow-up because not ALBUM).
      () => ({ ok: true, status: 201, headers: loginHeaders, json: () => Promise.resolve({ assets: [] }) }),
      // Subsequent download should reuse the seeded cookie.
      () => ({ ok: true, status: 200, headers: new Headers(), arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)) }),
    ]);

    const creds = { serverUrl: 'https://x', shareKey: 'k', password: 'pw', sourceId: 'src-3' };
    await fetchSharedLink(creds);
    await downloadImmichAsset(creds, 'asset-1');

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][1].headers.Cookie).toContain('immich_auth=from-sync');
  });
});

describe('SSRF guard on Immich serverUrl', () => {
  // validatePublicUrl only blocks private targets in production. Force prod
  // for these cases so the dev-mode loopback escape hatch does not interfere.
  // Production also turns on the DNS check, so lookups are answered by
  // mockLookup: a public documentation address unless a case says otherwise.
  beforeEach(() => {
    jest.replaceProperty(process.env, 'NODE_ENV', 'production');
    mockLookup.mockReset();
    mockLookup.mockResolvedValue([{ address: '203.0.113.10', family: 4 }]);
  });

  const sharePage = (body: Record<string, unknown>) => () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  });

  it('rejects fetchSharedLink with a loopback serverUrl', async () => {
    await expect(
      fetchSharedLink({ serverUrl: 'http://127.0.0.1:2283', shareKey: 'k' }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('accepts a server on the home network by its LAN address (#1286)', async () => {
    mockFetchOnce(sharePage({ password: null, assets: [] }));
    const link = await fetchSharedLink({ serverUrl: 'http://10.20.30.40:2283', shareKey: 'k' });
    expect(link.assets).toEqual([]);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'http://10.20.30.40:2283/api/shared-links/me?key=k',
    );
  });

  it('accepts a server by its IPv6 unique-local address (#1286)', async () => {
    mockFetchOnce(sharePage({ password: null, assets: [] }));
    await expect(
      fetchSharedLink({ serverUrl: 'http://[fd12:3456:789a::1]:2283', shareKey: 'k' }),
    ).resolves.toMatchObject({ assets: [] });
  });

  it('syncs an album from a server name that resolves into 100.64.0.0/10 (#1286)', async () => {
    mockLookup.mockResolvedValue([
      { address: '100.101.102.103', family: 4 },
      { address: 'fd7a:1234:5678::9', family: 6 },
    ]);
    mockFetchSequence([
      sharePage({ type: 'ALBUM', album: { id: 'album-1', albumName: 'Garden' }, password: null }),
      sharePage({
        assets: {
          nextPage: null,
          items: [{ id: 'a1', originalFileName: 'rose.jpg', originalMimeType: 'image/jpeg', type: 'IMAGE', fileCreatedAt: '2025-06-01T00:00:00.000Z' }],
        },
      }),
    ]);

    const link = await fetchSharedLink({ serverUrl: 'https://photos.vpn.example', shareKey: 'k' });

    expect(link.assets.map((a) => a.id)).toEqual(['a1']);
    expect(mockLookup).toHaveBeenCalledWith('photos.vpn.example', { all: true });
  });

  it('downloads an image from a server on the home network (#1286)', async () => {
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8]).buffer),
    }));
    const result = await downloadImmichAsset({ serverUrl: 'http://192.168.77.10:2283', shareKey: 'k' }, 'asset-1', { thumb: true });
    expect(result.contentType).toBe('image/jpeg');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'http://192.168.77.10:2283/api/assets/asset-1/thumbnail?key=k&size=preview',
    );
  });

  it('rejects fetchSharedLink with the cloud metadata IP', async () => {
    await expect(
      fetchSharedLink({ serverUrl: 'http://169.254.169.254', shareKey: 'k' }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it.each(['http://169.254.10.1', 'http://[fe80::1]', 'http://0.0.0.0:2283', 'http://localhost:2283'])(
    'still rejects fetchSharedLink with %s (link-local, unspecified, loopback name)',
    async (serverUrl) => {
      global.fetch = jest.fn();
      await expect(fetchSharedLink({ serverUrl, shareKey: 'k' })).rejects.toBeInstanceOf(UnsafeUrlError);
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  it('still rejects a server name that resolves to loopback or link-local', async () => {
    global.fetch = jest.fn();
    for (const address of ['127.0.0.1', '169.254.169.254']) {
      mockLookup.mockResolvedValue([{ address, family: 4 }]);
      await expect(
        fetchSharedLink({ serverUrl: 'https://photos.vpn.example', shareKey: 'k' }),
      ).rejects.toBeInstanceOf(UnsafeUrlError);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks a home-network server that 30x-redirects to loopback', async () => {
    mockFetchOnce(() => ({
      status: 302,
      headers: new Headers({ location: 'http://127.0.0.1:2283/api/assets/asset-1/thumbnail' }),
    }));
    await expect(
      downloadImmichAsset({ serverUrl: 'http://10.20.30.40:2283', shareKey: 'k' }, 'asset-1'),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('rejects downloadImmichAsset with a loopback serverUrl', async () => {
    await expect(
      downloadImmichAsset({ serverUrl: 'http://127.0.0.1', shareKey: 'k' }, 'asset-1'),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('rejects downloadImmichAsset with an IPv6 loopback serverUrl', async () => {
    await expect(
      downloadImmichAsset({ serverUrl: 'http://[::1]', shareKey: 'k' }, 'asset-1'),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('blocks a public share URL that 30x-redirects to an internal host', async () => {
    // The initial (public) host passes the guard, but the response redirects
    // to the cloud metadata IP. safeFetch must re-validate the Location and
    // refuse to follow it — the old `redirect: 'follow'` would have fetched it.
    mockFetchOnce(() => ({
      status: 302,
      headers: new Headers({ location: 'http://169.254.169.254/latest/meta-data' }),
    }));

    await expect(
      downloadImmichAsset({ serverUrl: 'https://immich.example.com', shareKey: 'k' }, 'asset-1'),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    // Only the first (public) hop was fetched; the internal target never was.
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });
});
