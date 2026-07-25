/**
 * Tests for the Tandoor recipe import client. The fixture mirrors the real
 * shape observed from a live Tandoor v1 instance: steps carry ingredients with
 * `original_text` + structured food/unit/amount, `working_time`/`waiting_time`,
 * keywords, and an `image` reported on Tandoor's own origin.
 */

import {
  normalizeTandoorRecipe,
  testTandoorConnection,
  fetchTandoorImage,
  UnsafeUrlError,
  type TandoorRecipeDetail,
} from '../tandoor';

afterEach(() => {
  jest.clearAllMocks();
});

const DETAIL: TandoorRecipeDetail = {
  id: 2,
  name: '16 Bean Pasta e Fagioli',
  description: 'From Barefoot Contessa.',
  image: 'http://localhost:8082/media/recipes/abc_2.jpg',
  keywords: [{ name: 'ina garten' }, { name: 'lunch' }],
  working_time: 0,
  waiting_time: 30,
  servings: 6,
  updated_at: '2026-07-20T12:00:00.000Z',
  steps: [
    {
      name: 'Ingredients',
      instruction: 'Soak the beans overnight.',
      ingredients: [
        { food: { name: 'Section' }, is_header: true, note: 'For the soup' },
        {
          food: { name: 'olive oil' },
          unit: { name: 'tablespoons' },
          amount: 2,
          note: 'plus extra',
          original_text: '2 tablespoons good olive oil, plus extra for serving',
        },
        { food: { name: 'pancetta' }, unit: { name: 'ounces' }, amount: 6, note: 'diced' },
        { food: { name: 'salt' }, no_amount: true, note: 'to taste' },
      ],
    },
    { instruction: 'Simmer for 30 minutes.', ingredients: [] },
  ],
};

describe('normalizeTandoorRecipe', () => {
  it('maps core fields and re-anchors the image onto the connected serverUrl', () => {
    const r = normalizeTandoorRecipe(DETAIL, 'https://tandoor.example.com/');
    expect(r.externalId).toBe('2');
    expect(r.externalUpdatedAt).toEqual(new Date('2026-07-20T12:00:00.000Z'));
    expect(r.name).toBe('16 Bean Pasta e Fagioli');
    expect(r.description).toBe('From Barefoot Contessa.');
    expect(r.url).toBe('https://tandoor.example.com/view/recipe/2');
    expect(r.prepTime).toBeNull(); // working_time 0 → null
    expect(r.cookTime).toBe(30);
    expect(r.servings).toBe(6);
    expect(r.tags).toEqual(['ina garten', 'lunch']);
    // Image host swapped from Tandoor's localhost:8082 to the server we connected to.
    expect(r.remoteImageUrl).toBe('https://tandoor.example.com/media/recipes/abc_2.jpg');
  });

  it('prefers original_text, composes structured lines otherwise, and keeps headers', () => {
    const r = normalizeTandoorRecipe(DETAIL, 'https://tandoor.example.com');
    expect(r.ingredients).toEqual([
      { heading: 'For the soup' },
      { text: '2 tablespoons good olive oil, plus extra for serving' }, // original_text
      { text: '6 ounces pancetta (diced)' }, // composed from structured fields
      { text: 'salt (to taste)' }, // no_amount → no leading amount
    ]);
  });

  it('joins step instructions into a single block', () => {
    const r = normalizeTandoorRecipe(DETAIL, 'https://tandoor.example.com');
    expect(r.instructions).toBe(
      'Ingredients\nSoak the beans overnight.\n\nSimmer for 30 minutes.',
    );
  });
});

describe('testTandoorConnection', () => {
  it('returns the recipe count on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({ count: 3, results: [] }),
    }) as unknown as typeof fetch;

    const res = await testTandoorConnection('https://tandoor.example.com', 'tok');
    expect(res.count).toBe(3);
  });

  it('throws a clear error when the token is rejected (401)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    }) as unknown as typeof fetch;

    await expect(testTandoorConnection('https://tandoor.example.com', 'bad')).rejects.toThrow(/token/i);
  });

  it('rejects a private serverUrl (SSRF) before making any request', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(testTandoorConnection('http://10.0.0.5', 'tok')).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchTandoorImage', () => {
  it('returns a Buffer for a successful download', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: () => Promise.resolve(new Uint8Array([0xff, 0xd8]).buffer),
    }) as unknown as typeof fetch;

    const buf = await fetchTandoorImage('https://tandoor.example.com/media/x.jpg', 'tok');
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf?.length).toBe(2);
  });

  it('returns null on a failed download (never throws)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
    }) as unknown as typeof fetch;

    expect(await fetchTandoorImage('https://tandoor.example.com/media/missing.jpg', 'tok')).toBeNull();
  });
});
