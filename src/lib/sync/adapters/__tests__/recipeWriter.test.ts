/**
 * A synced recipe's image is downloaded on the server (#1245). The source's
 * token goes only to the server it was given for: an image anywhere else is
 * fetched without it.
 */
import { fetchRemoteImage } from '../recipeWriter';

jest.mock('@/lib/db/client', () => ({ db: {} }));
jest.mock('@/lib/services/recipe-image-storage', () => ({ saveRecipeImage: jest.fn() }));

const SOURCE = { serverUrl: 'https://tandoor.example.com/', token: 'tok' };
const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8]).buffer),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});
const sentAuthorization = () => new Headers(fetchMock.mock.calls[0]![1].headers).get('authorization');

describe('fetchRemoteImage', () => {
  it('sends the token to an image on the connected server', async () => {
    const buf = await fetchRemoteImage('https://tandoor.example.com/media/recipes/2.jpg', SOURCE);
    expect(buf?.length).toBe(2);
    expect(sentAuthorization()).toBe('Bearer tok');
  });

  it.each([
    ['another host', 'https://cdn.example.net/recipes/2.jpg'],
    ['the same host on another port', 'https://tandoor.example.com:8443/media/2.jpg'],
    ['the same host over http', 'http://tandoor.example.com/media/2.jpg'],
    ['a look-alike name', 'https://tandoor.example.com.evil.example/media/2.jpg'],
  ])('fetches an image on %s without the token', async (_what, url) => {
    expect((await fetchRemoteImage(url, SOURCE))?.length).toBe(2);
    expect(sentAuthorization()).toBeNull();
  });

  it('returns null on a failed download (never throws)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, headers: new Headers() });
    expect(await fetchRemoteImage('https://tandoor.example.com/media/missing.jpg', SOURCE)).toBeNull();
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await fetchRemoteImage('https://tandoor.example.com/media/x.jpg', SOURCE)).toBeNull();
  });
});
