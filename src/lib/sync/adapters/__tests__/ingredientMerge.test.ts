/**
 * Sending ingredients and steps back without losing structure (#1215). A line
 * that did not change in Prism keeps its Tandoor or Mealie ingredient object;
 * a new or edited line goes as a plain note; steps go only to a recipe with
 * one step. Fixtures follow what a Tandoor v2 and a Mealie v3.21 server return.
 */

import { describeRecipePush, matchLines, plainLineCount } from '../ingredientLines';
import { mergeTandoorSteps, normalizeTandoorRecipe, type TandoorRecipeDetail } from '@/lib/integrations/tandoor';
import { mergeMealieRecipe, normalizeMealieRecipe, type MealieRecipeDetail } from '@/lib/integrations/mealie';

describe('matchLines', () => {
  it('keeps each unchanged line once, in order, and marks new or edited lines', () => {
    const remote = [{ text: 'a' }, { heading: 'Sauce' }, { text: 'b' }, { text: 'a' }];
    const local = [{ text: 'a' }, { text: 'a' }, { text: 'c' }, { heading: 'Sauce' }];
    expect(matchLines(local, remote)).toEqual([0, 3, null, 1]);
    expect(plainLineCount(local, remote)).toBe(1);
  });

  it('never matches a heading to a text line with the same words', () => {
    expect(matchLines([{ heading: 'Salt' }], [{ text: 'Salt' }])).toEqual([null]);
  });
});

describe('describeRecipePush', () => {
  const remote = { ingredients: [{ text: '1 onion' }], instructions: 'Chop.', stepCount: 2 };
  it('says how many lines go as notes and that the steps of a split recipe stay', () => {
    expect(describeRecipePush({ ingredients: [{ text: '1 onion' }, { text: 'salt' }], instructions: 'Chop finely.' }, remote, 'Tandoor'))
      .toEqual(['1 ingredient line goes as plain notes', 'the steps stay as they are in Tandoor, which has 2']);
  });
  it('says nothing when neither changed', () => {
    expect(describeRecipePush({ ingredients: [{ text: '1 onion' }], instructions: 'Chop.' }, remote, 'Tandoor')).toEqual([]);
  });
});

// --- Tandoor ---

const food = (id: number, name: string) => ({ id, name });
const TANDOOR: TandoorRecipeDetail = {
  id: 4,
  name: 'Soup',
  steps: [
    {
      id: 10, name: '', instruction: 'Chop the onion.', time: 0, order: 0, show_as_header: false, show_ingredients_table: true,
      ingredients: [
        { id: 100, food: food(1, 'onion'), unit: { name: 'piece' }, amount: '1.0000', note: '', order: 0, original_text: null },
        { id: 101, food: food(2, 'Carrot'), unit: { name: 'piece' }, amount: '2.0000', note: 'diced', order: 1, original_text: null },
      ],
    },
    {
      id: 11, name: '', instruction: 'Simmer.', time: 0, order: 1, show_as_header: false, show_ingredients_table: true,
      ingredients: [{ id: 102, food: food(3, 'stock'), unit: { name: 'cup' }, amount: '4.0000', note: '', order: 0, original_text: null }],
    },
  ],
} as unknown as TandoorRecipeDetail;
const tandoorLines = normalizeTandoorRecipe(TANDOOR, 'https://tandoor.example.com').ingredients;

describe('mergeTandoorSteps', () => {
  it('keeps unchanged lines as their objects in their own step, and adds edited and new lines as notes', () => {
    const steps = mergeTandoorSteps(TANDOOR, {
      ingredients: [tandoorLines[0]!, { text: '3 carrots, sliced' }, tandoorLines[2]!, { text: 'pinch of salt' }],
      instructions: 'Chop the onion.\n\nSimmer.',
    })!;
    expect(steps.map((s) => s.id)).toEqual([10, 11]);
    const [first, second] = steps.map((s) => s.ingredients as Array<Record<string, unknown>>);
    expect(first!.map((i) => i.id ?? i.note)).toEqual([100, '3 carrots, sliced']);
    expect(first![0]).toMatchObject({ food: food(1, 'onion'), amount: '1.0000' });
    expect(first![1]).toMatchObject({ food: null, unit: null, no_amount: true, original_text: '3 carrots, sliced' });
    expect(second!.map((i) => i.id ?? i.note)).toEqual([102, 'pinch of salt']);
  });

  it('leaves the steps\' text alone on a recipe with more than one step', () => {
    const steps = mergeTandoorSteps(TANDOOR, { ingredients: [...tandoorLines, { text: 'salt' }], instructions: 'All new text' })!;
    expect(steps.map((s) => s.instruction)).toEqual(['Chop the onion.', 'Simmer.']);
  });

  it('sets the text of a recipe with one step', () => {
    const one = { ...TANDOOR, steps: [TANDOOR.steps![0]!] } as TandoorRecipeDetail;
    const lines = normalizeTandoorRecipe(one, 'https://tandoor.example.com').ingredients;
    const steps = mergeTandoorSteps(one, { ingredients: lines, instructions: 'Chop it all.' })!;
    expect(steps[0]).toMatchObject({ id: 10, instruction: 'Chop it all.' });
    expect((steps[0]!.ingredients as Array<{ id?: number }>).map((i) => i.id)).toEqual([100, 101]);
  });

  it('sends nothing when the lines and steps are as Tandoor has them', () => {
    expect(mergeTandoorSteps(TANDOOR, { ingredients: tandoorLines, instructions: 'Chop the onion.\n\nSimmer.' })).toBeNull();
  });
});

// --- Mealie ---

const MEALIE: MealieRecipeDetail = {
  id: 'r-1',
  slug: 'hot-dogs',
  name: 'Hot dogs',
  recipeIngredient: [
    { referenceId: 'i-1', title: 'Pickle', quantity: 0.25, unit: { name: 'cup' }, food: { id: 'f-1', name: 'water' }, note: '', display: '¼ cup water' },
    { referenceId: 'i-2', title: '', quantity: 1, unit: { name: 'teaspoon' }, food: { id: 'f-2', name: 'salt' }, note: '', display: '1 teaspoon salt' },
    { referenceId: 'i-3', title: '', quantity: 6, unit: null, food: { id: 'f-3', name: 'hot dogs' }, note: '', display: '6 hot dogs' },
  ],
  recipeInstructions: [{ id: 's-1', title: '', text: 'Mix and serve.' }],
} as unknown as MealieRecipeDetail;
const mealieLines = normalizeMealieRecipe(MEALIE, 'https://mealie.example.com').ingredients;

describe('mergeMealieRecipe', () => {
  it('keeps unchanged ingredients with their food, drops a removed one, adds a new line as a note, and keeps the heading', () => {
    // Remove "1 teaspoon salt", add a line at the end.
    const local = { ingredients: [mealieLines[0]!, mealieLines[1]!, mealieLines[3]!, { text: 'mustard' }], instructions: 'Mix and serve.' };
    const { recipeIngredient, recipeInstructions } = mergeMealieRecipe(MEALIE, local);
    expect(recipeIngredient!.map((i) => i.referenceId === 'i-1' || i.referenceId === 'i-3' ? i.referenceId : i.note))
      .toEqual(['i-1', 'i-3', 'mustard']);
    expect(recipeIngredient![0]).toMatchObject({ title: 'Pickle', food: { id: 'f-1', name: 'water' } });
    expect(recipeIngredient![2]).toMatchObject({ food: null, unit: null, quantity: 0, title: '' });
    expect(recipeInstructions).toBeNull();
  });

  it('sets the text of a recipe with one step, keeping its id', () => {
    const { recipeIngredient, recipeInstructions } = mergeMealieRecipe(MEALIE, { ingredients: mealieLines, instructions: 'Grill, then serve.' });
    expect(recipeIngredient).toBeNull();
    expect(recipeInstructions).toEqual([{ id: 's-1', title: '', text: 'Grill, then serve.' }]);
  });

  it('leaves the steps of a recipe with several alone', () => {
    const two = { ...MEALIE, recipeInstructions: [{ text: 'Mix.' }, { text: 'Serve.' }] } as MealieRecipeDetail;
    expect(mergeMealieRecipe(two, { ingredients: mealieLines, instructions: 'One new step' }).recipeInstructions).toBeNull();
  });
});
