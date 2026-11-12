import { resetSharedGet, sharedGet } from '../sharedGet';

/** #1081: readers that start together share one request; nothing is reused after. */
describe('sharedGet', () => {
  let resolve: (r: Response) => void;
  const fetchMock = jest.fn();
  beforeEach(() => {
    resetSharedGet();
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => new Promise<Response>((r) => { resolve = r; }));
    global.fetch = fetchMock;
  });

  it('readers that start while a request is in flight share it, each with its own body', async () => {
    const a = sharedGet('/api/settings');
    const b = sharedGet('/api/settings');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(new Response(JSON.stringify({ settings: { x: 1 } })));
    const [ra, rb] = await Promise.all([a, b]);
    expect(await ra.json()).toEqual({ settings: { x: 1 } });
    expect(await rb.json()).toEqual({ settings: { x: 1 } });
  });

  it('a read after the response arrived asks again, so a write is always seen', async () => {
    const a = sharedGet('/api/settings');
    resolve(new Response('{}'));
    await a;
    void sharedGet('/api/settings');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('different URLs are not shared', () => {
    void sharedGet('/api/settings');
    void sharedGet('/api/layouts');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a request hung for over 10 seconds is not joined', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    void sharedGet('/api/settings');
    now.mockReturnValue(1_000_000 + 10_001);
    void sharedGet('/api/settings');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });
});
