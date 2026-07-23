/**
 * SSRF-guard tests for the CardDAV client (audit 2026-07 · M-SSRF).
 *
 * fetchCardDAVBirthdays validates the *derived* URL (deriveCardDAVUrl swaps
 * the iCloud CalDAV host for the CardDAV one) — that derived URL is what
 * tsdav actually fetches, so a private target must be rejected there before
 * createDAVClient runs.
 */

const mockCreateDAVClient = jest.fn();
jest.mock('tsdav', () => ({
  createDAVClient: (...a: unknown[]) => mockCreateDAVClient(...a),
}));
jest.mock('ical.js', () => ({}));

import { fetchCardDAVBirthdays, deriveCardDAVUrl } from '../carddav';
import { UnsafeUrlError } from '@/lib/utils/safeFetch';

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(process.env, 'NODE_ENV', 'production');
});

describe('deriveCardDAVUrl', () => {
  it('swaps the iCloud CalDAV host for the CardDAV host', () => {
    expect(deriveCardDAVUrl('https://caldav.icloud.com/123/calendars')).toBe(
      'https://contacts.icloud.com/123/calendars',
    );
  });
  it('passes non-iCloud hosts through unchanged', () => {
    expect(deriveCardDAVUrl('https://cloud.example.com/remote.php/dav')).toBe(
      'https://cloud.example.com/remote.php/dav',
    );
  });
});

describe('fetchCardDAVBirthdays SSRF guard', () => {
  const PRIVATE_URLS = [
    'http://127.0.0.1/dav',
    'http://10.0.0.5/remote.php/dav',
    'http://192.168.1.10/dav',
    'http://169.254.169.254/',
    'http://[::1]/dav',
    'http://localhost/dav',
  ];

  it.each(PRIVATE_URLS)('rejects %s without contacting tsdav', async (url) => {
    await expect(fetchCardDAVBirthdays(url, 'u', 'p')).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(mockCreateDAVClient).not.toHaveBeenCalled();
  });

  it('rejects when a public iCloud CalDAV host derives to something private (guards the derived URL)', async () => {
    // deriveCardDAVUrl only rewrites the iCloud host; this asserts the guard
    // runs on the post-derivation URL, not the raw input.
    await expect(
      fetchCardDAVBirthdays('http://10.0.0.5/caldav.icloud.com', 'u', 'p'),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(mockCreateDAVClient).not.toHaveBeenCalled();
  });

  it('allows a public host through and fetches the derived URL', async () => {
    mockCreateDAVClient.mockResolvedValue({
      fetchAddressBooks: jest.fn().mockResolvedValue([]),
      fetchVCards: jest.fn().mockResolvedValue([]),
    });
    await fetchCardDAVBirthdays('https://caldav.icloud.com/123/principal', 'u', 'p');
    expect(mockCreateDAVClient).toHaveBeenCalledTimes(1);
    expect(mockCreateDAVClient.mock.calls[0][0].serverUrl).toBe(
      'https://contacts.icloud.com/123/principal',
    );
  });
});
