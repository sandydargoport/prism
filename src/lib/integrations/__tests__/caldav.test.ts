/**
 * SSRF-guard tests for the CalDAV client (audit 2026-07 · H5).
 *
 * Every exported entry point must reject a private / loopback / metadata
 * serverUrl BEFORE it hands the URL to tsdav (which performs the outbound
 * request). testCalDAVConnection returns a friendly {success:false}; the
 * remaining functions throw UnsafeUrlError. In all cases createDAVClient
 * must never be reached, so the guard cannot be used as an internal-host
 * existence oracle.
 */

// --- tsdav mock: a spy so we can assert it is never called on rejection ---
const mockCreateDAVClient = jest.fn();
jest.mock('tsdav', () => ({
  createDAVClient: (...a: unknown[]) => mockCreateDAVClient(...a),
}));
// ical.js is only exercised on the (unreached) success path here.
jest.mock('ical.js', () => ({}));

import {
  testCalDAVConnection,
  discoverCalendars,
  fetchCalDAVEvents,
  fetchCalDAVTasks,
  createCalDAVEvent,
  updateCalDAVEvent,
  deleteCalDAVEvent,
} from '../caldav';
import { UnsafeUrlError } from '@/lib/utils/safeFetch';

// Guard only blocks private targets in production; force prod so the dev
// loopback escape hatch does not mask the rejection.
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(process.env, 'NODE_ENV', 'production');
});

const PRIVATE_URLS = [
  'http://127.0.0.1:5232',
  'http://10.0.0.5/dav',
  'http://192.168.1.10/remote.php/dav',
  'http://169.254.169.254/latest/meta-data',
  'http://[::1]:5232',
  'http://localhost:5232',
];

const EV = {
  uid: 'u1',
  title: 'T',
  startTime: new Date('2026-01-01T10:00:00Z'),
  endTime: new Date('2026-01-01T11:00:00Z'),
};

describe('testCalDAVConnection', () => {
  it.each(PRIVATE_URLS)('returns {success:false} without contacting tsdav for %s', async (url) => {
    const result = await testCalDAVConnection(url, 'user', 'pass');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not allowed|private or local/i);
    expect(mockCreateDAVClient).not.toHaveBeenCalled();
  });

  it('does not distinguish an existing internal host from a missing one (no oracle)', async () => {
    const a = await testCalDAVConnection('http://10.0.0.5', 'u', 'p');
    const b = await testCalDAVConnection('http://10.0.0.6', 'u', 'p');
    expect(a).toEqual(b);
    expect(mockCreateDAVClient).not.toHaveBeenCalled();
  });
});

describe('exported functions throw UnsafeUrlError on a private serverUrl', () => {
  it('discoverCalendars', async () => {
    await expect(discoverCalendars('http://10.0.0.5', 'u', 'p')).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(mockCreateDAVClient).not.toHaveBeenCalled();
  });
  it('fetchCalDAVEvents', async () => {
    await expect(
      fetchCalDAVEvents('http://127.0.0.1', 'u', 'p', '/cal', new Date(), new Date()),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(mockCreateDAVClient).not.toHaveBeenCalled();
  });
  it('fetchCalDAVTasks', async () => {
    await expect(
      fetchCalDAVTasks('http://192.168.0.2', 'u', 'p', '/cal'),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(mockCreateDAVClient).not.toHaveBeenCalled();
  });
  it('createCalDAVEvent', async () => {
    await expect(
      createCalDAVEvent('http://169.254.169.254', 'u', 'p', '/cal', EV),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(mockCreateDAVClient).not.toHaveBeenCalled();
  });
  it('updateCalDAVEvent', async () => {
    await expect(
      updateCalDAVEvent('http://[::1]', 'u', 'p', '/cal/o.ics', undefined, EV),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(mockCreateDAVClient).not.toHaveBeenCalled();
  });
  it('deleteCalDAVEvent', async () => {
    await expect(
      deleteCalDAVEvent('http://localhost', 'u', 'p', '/cal/o.ics'),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(mockCreateDAVClient).not.toHaveBeenCalled();
  });
});

describe('public serverUrl is allowed through to tsdav', () => {
  it('discoverCalendars reaches createDAVClient for a public host', async () => {
    mockCreateDAVClient.mockResolvedValue({ fetchCalendars: jest.fn().mockResolvedValue([]) });
    await discoverCalendars('https://caldav.icloud.com', 'u', 'p');
    expect(mockCreateDAVClient).toHaveBeenCalledTimes(1);
  });
});
