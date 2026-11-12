/**
 * safeFetch resolves each hostname and refuses one pointed at a non-public
 * address (#809), and a calendar-style redirect chain is checked hop by hop.
 * Addresses come from reserved, non-LAN ranges (198.18.0.0/15, benchmarking;
 * 203.0.113.0/24, documentation) so the test holds no real network.
 */
import { safeFetch, UnsafeUrlError, validatePublicUrl, type HostResolver } from '../safeFetch';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
});

const ok = () => ({ status: 200, ok: true, headers: new Headers() }) as unknown as Response;
const redirect = (to: string) => ({ status: 302, ok: false, headers: new Headers({ location: to }) }) as unknown as Response;
const resolver = (map: Record<string, string[]>): HostResolver => async (host) => {
  if (!(host in map)) throw new Error('ENOTFOUND');
  return map[host]!;
};

describe('safeFetch resolves hostnames (#809)', () => {
  it('fetches a name that resolves to a public address', async () => {
    fetchMock.mockResolvedValue(ok());
    await safeFetch('https://feeds.example.org/cal.ics', {}, { resolveHost: resolver({ 'feeds.example.org': ['203.0.113.10'] }) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a name that resolves to a non-public address, before fetching', async () => {
    await expect(safeFetch('https://db/', {}, { resolveHost: resolver({ db: ['198.18.0.7'] }) })).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(safeFetch('https://inward.example.org/', {}, { resolveHost: resolver({ 'inward.example.org': ['203.0.113.10', '198.18.0.7'] }) })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks where a redirect goes, too', async () => {
    fetchMock.mockResolvedValueOnce(redirect('https://inward.example.org/x'));
    const resolveHost = resolver({ 'feeds.example.org': ['203.0.113.10'], 'inward.example.org': ['198.18.0.7'] });
    await expect(safeFetch('https://feeds.example.org/cal.ics', {}, { resolveHost })).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lets an operator-allowlisted host through, and leaves a name it cannot resolve to fetch', async () => {
    fetchMock.mockResolvedValue(ok());
    await safeFetch('https://nas.example.org/', {}, { resolveHost: resolver({ 'nas.example.org': ['198.18.0.9'] }), allowedInternalHosts: ['nas.example.org'] });
    await safeFetch('https://missing.example.org/', {}, { resolveHost: resolver({}) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('reserved IPv4 ranges (#809)', () => {
  it.each(['198.18.0.1', '198.19.255.1', '192.0.0.8', '224.0.0.1', '255.255.255.255'])('refuses %s', (ip) => {
    expect(() => validatePublicUrl(`http://${ip}/`, { isProduction: true })).toThrow(UnsafeUrlError);
  });
});
