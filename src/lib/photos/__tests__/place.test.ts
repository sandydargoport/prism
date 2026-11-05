import { placeFromAddress, reversePlace } from '../place';

describe('the place of a photo (#958)', () => {
  it('names a town and its state or country', () => {
    expect(placeFromAddress({ town: 'Springfield', state: 'Oregon', country: 'USA' })).toBe('Springfield, Oregon');
    expect(placeFromAddress({ village: 'Hallstatt', country: 'Austria' })).toBe('Hallstatt, Austria');
    expect(placeFromAddress({ country: 'Iceland' })).toBe('Iceland');
    expect(placeFromAddress(undefined)).toBeNull();
  });

  it('sends only a rounded location, about a kilometre, at town level', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ address: { city: 'Springfield', state: 'Oregon' } }) });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    expect(await reversePlace(44.046236, -123.022034)).toBe('Springfield, Oregon');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('lat')).toBe('44.05');
    expect(url.searchParams.get('lon')).toBe('-123.02');
    expect(url.searchParams.get('zoom')).toBe('10');
  });
});
