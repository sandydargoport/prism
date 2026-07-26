import { scaleIngredientText, formatQuantity } from '../scaleIngredient';

describe('scaleIngredientText — leading quantity only', () => {
  it('scales only the leading count, not a pack/size number (the reported bug)', () => {
    // "1 8 oz can" doubled → "2 8 oz can", NOT "2 16 oz can".
    expect(scaleIngredientText('1 8 oz can diced tomatoes', 2)).toBe('2 8 oz can diced tomatoes');
  });

  it('scales a leading amount that IS the quantity', () => {
    expect(scaleIngredientText('8 oz cream cheese', 2)).toBe('16 oz cream cheese');
    expect(scaleIngredientText('2 cups flour', 2)).toBe('4 cups flour');
  });

  it('handles mixed numbers', () => {
    expect(scaleIngredientText('1 1/2 cups sugar', 2)).toBe('3 cups sugar');
  });

  it('handles fractions', () => {
    expect(scaleIngredientText('3/4 cup milk', 2)).toBe('1 1/2 cup milk');
    expect(scaleIngredientText('1/2 tsp salt', 0.5)).toBe('1/4 tsp salt');
  });

  it('scales the first number even when preceded by words', () => {
    expect(scaleIngredientText('about 2 cups broth', 2)).toBe('about 4 cups broth');
  });

  it('leaves size descriptors and pan dimensions alone', () => {
    expect(scaleIngredientText('1 9x13 pan', 2)).toBe('2 9x13 pan');
  });

  it('halves correctly', () => {
    expect(scaleIngredientText('4 large eggs', 0.5)).toBe('2 large eggs');
  });

  it('no-ops on factor 1 or lines without numbers', () => {
    expect(scaleIngredientText('2 cups flour', 1)).toBe('2 cups flour');
    expect(scaleIngredientText('Salt to taste', 2)).toBe('Salt to taste');
  });
});

describe('formatQuantity', () => {
  it('renders wholes, fractions, and mixed numbers', () => {
    expect(formatQuantity(3)).toBe('3');
    expect(formatQuantity(0.5)).toBe('1/2');
    expect(formatQuantity(2.5)).toBe('2 1/2');
    expect(formatQuantity(0.75)).toBe('3/4');
  });
});
