/**
 * Mealie meal-plan writes (#1206). Response shapes follow Mealie v3.21's
 * ReadPlanEntry; an update replaces the whole entry and needs its group and
 * user, so it reads the entry first.
 */

import {
  createMealieMealPlanEntry,
  updateMealieMealPlanEntry,
  deleteMealieMealPlanEntry,
  updateMealieRecipe,
  deleteMealieRecipe,
} from '../mealie';

const STORED = {
  date: '2026-11-20',
  entryType: 'dinner',
  title: 'Tacos',
  text: '',
  recipeId: null,
  id: 12,
  groupId: 'g-1',
  userId: 'u-1',
  householdId: 'h-1',
  recipe: null,
};
const WRITE = { date: '2026-11-21', entryType: 'dinner' as const, title: 'Tacos', text: '', recipeId: null };

const answer = (status: number, body: unknown = STORED) => ({
  ok: status >= 200 && status < 300, status, statusText: '', headers: new Headers(), json: () => Promise.resolve(body),
});

afterEach(() => jest.clearAllMocks());

describe('Mealie meal-plan writes', () => {
  it('adds an entry with a POST and returns what Mealie stored', async () => {
    const fetchMock = jest.fn().mockResolvedValue(answer(201));
    global.fetch = fetchMock as unknown as typeof fetch;
    const stored = await createMealieMealPlanEntry('https://mealie.example.com', 'tok', WRITE);
    expect(fetchMock.mock.calls[0][0]).toBe('https://mealie.example.com/api/households/mealplans');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(WRITE);
    expect(stored.id).toBe(12);
  });

  it('moves an entry by reading it, then sending it whole with its group and user', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(answer(200))
      .mockResolvedValueOnce(answer(200, { ...STORED, date: '2026-11-21' }));
    global.fetch = fetchMock as unknown as typeof fetch;
    await updateMealieMealPlanEntry('https://mealie.example.com', 'tok', '12', WRITE);
    expect(fetchMock.mock.calls[0][1].method ?? 'GET').toBe('GET');
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://mealie.example.com/api/households/mealplans/12');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ id: 12, groupId: 'g-1', userId: 'u-1', ...WRITE });
  });

  it('removes an entry, and one already gone counts as removed', async () => {
    const fetchMock = jest.fn().mockResolvedValue(answer(200));
    global.fetch = fetchMock as unknown as typeof fetch;
    await deleteMealieMealPlanEntry('https://mealie.example.com', 'tok', '12');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    global.fetch = jest.fn().mockResolvedValue(answer(404, null)) as unknown as typeof fetch;
    await expect(deleteMealieMealPlanEntry('https://mealie.example.com', 'tok', '12')).resolves.toBeUndefined();
  });
});

describe('Mealie recipe writes (#1207)', () => {
  it('sends name, description, servings and times as a partial update by id, and returns Mealie\'s new time', async () => {
    const fetchMock = jest.fn().mockResolvedValue(answer(200, { id: 'uuid-1', slug: 'tacos', updatedAt: '2026-11-13T11:00:00Z' }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const seen = await updateMealieRecipe('https://mealie.example.com', 'tok', 'uuid-1', {
      name: 'Tacos', description: 'Weeknight', servings: 4, prepTime: 15, cookTime: null,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://mealie.example.com/api/recipes/uuid-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({
      name: 'Tacos', description: 'Weeknight', recipeServings: 4, prepTime: '15 minutes', performTime: null,
    });
    expect(seen).toEqual(new Date('2026-11-13T11:00:00Z'));
  });

  it('reports a refusal (a recipe someone else locked) for that recipe', async () => {
    global.fetch = jest.fn().mockResolvedValue(answer(403, { detail: 'Forbidden' })) as unknown as typeof fetch;
    await expect(updateMealieRecipe('https://mealie.example.com', 'tok', 'uuid-1', {
      name: 'Tacos', description: null, servings: null, prepTime: null, cookTime: null,
    })).rejects.toThrow(/Mealie refused/);
  });

  it('deletes a recipe, and one already gone counts as deleted', async () => {
    const fetchMock = jest.fn().mockResolvedValue(answer(200, {}));
    global.fetch = fetchMock as unknown as typeof fetch;
    await deleteMealieRecipe('https://mealie.example.com', 'tok', 'uuid-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    global.fetch = jest.fn().mockResolvedValue(answer(404, null)) as unknown as typeof fetch;
    await expect(deleteMealieRecipe('https://mealie.example.com', 'tok', 'uuid-1')).resolves.toBeUndefined();
  });
});
