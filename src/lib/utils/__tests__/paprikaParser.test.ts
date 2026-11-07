import { parsePaprikaHtml } from '../paprikaParser';

describe('parsePaprikaHtml', () => {
  describe('single recipe parsing', () => {
    it('extracts name from h1', () => {
      const html = '<html><body><h1>Chocolate Cake</h1></body></html>';
      const recipes = parsePaprikaHtml(html);
      expect(recipes).toHaveLength(1);
      expect(recipes[0]!.name).toBe('Chocolate Cake');
    });

    it('returns empty array for untitled content', () => {
      const html = '<html><body><p>No recipe here</p></body></html>';
      expect(parsePaprikaHtml(html)).toHaveLength(0);
    });

    it('extracts description', () => {
      const html = `
        <h1>Pasta</h1>
        <div class="description">A tasty pasta dish</div>
      `;
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.description).toBe('A tasty pasta dish');
    });

    it('extracts ingredients from list items', () => {
      const html = `
        <h1>Salad</h1>
        <div class="ingredients">
          <li>2 cups lettuce</li>
          <li>1 tomato</li>
          <li>Dressing</li>
        </div>
      `;
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.ingredients).toHaveLength(3);
      expect(recipe.ingredients[0]!.text).toBe('2 cups lettuce');
      expect(recipe.ingredients[1]!.text).toBe('1 tomato');
    });

    it('extracts instructions', () => {
      const html = `
        <h1>Soup</h1>
        <div class="instructions">Boil water. Add ingredients. Simmer.</div>
      `;
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.instructions).toBe('Boil water. Add ingredients. Simmer.');
    });

    it('extracts source URL', () => {
      const html = `
        <h1>Bread</h1>
        source: <a href="https://example.com/bread">Example</a>
      `;
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.sourceUrl).toBe('https://example.com/bread');
    });

    it('extracts categories', () => {
      const html = `
        <h1>Stew</h1>
        categories: Dinner, Comfort Food, Winter
      `;
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.categories).toEqual(['Dinner', 'Comfort Food', 'Winter']);
    });

    it('extracts notes', () => {
      const html = `
        <h1>Pizza</h1>
        <div class="notes">Best served hot. Can freeze dough.</div>
      `;
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.notes).toBe('Best served hot. Can freeze dough.');
    });
  });

  describe('time parsing', () => {
    it('parses "30 min"', () => {
      const html = '<h1>Quick Meal</h1> prep time: 30 min';
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.prepTime).toBe(30);
    });

    it('parses "1 hr 30 min"', () => {
      const html = '<h1>Slow Cook</h1> cook time: 1 hr 30 min';
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.cookTime).toBe(90);
    });

    it('parses "2 hours"', () => {
      const html = '<h1>Roast</h1> total time: 2 hours';
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.totalTime).toBe(120);
    });

    it('handles missing time gracefully', () => {
      const html = '<h1>Simple</h1>';
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.prepTime).toBeUndefined();
      expect(recipe.cookTime).toBeUndefined();
    });
  });

  describe('servings parsing', () => {
    it('parses "4 servings"', () => {
      const html = '<h1>Dish</h1> servings: 4 servings';
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.servings).toBe(4);
    });

    it('parses "Serves 6"', () => {
      const html = '<h1>Dish</h1> Serves 6';
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.servings).toBe(6);
    });
  });

  describe('rating parsing', () => {
    it('counts filled stars', () => {
      const html = '<h1>Good</h1> <span class="rating">★★★★☆</span>';
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.rating).toBe(4);
    });

    it('parses "3 stars"', () => {
      const html = '<h1>OK</h1> rating: 3 stars';
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.rating).toBe(3);
    });

    it('parses "4/5" format', () => {
      const html = '<h1>Nice</h1> rating: 4/5';
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.rating).toBe(4);
    });
  });

  describe('HTML entity handling', () => {
    it('decodes HTML entities in text', () => {
      const html = '<h1>Mac &amp; Cheese</h1>';
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.name).toBe('Mac & Cheese');
    });

    it('converts br tags to newlines', () => {
      const html = `
        <h1>Recipe</h1>
        <div class="instructions">Step 1<br/>Step 2<br>Step 3</div>
      `;
      const recipe = parsePaprikaHtml(html)[0]!;
      expect(recipe.instructions).toContain('Step 1\nStep 2\nStep 3');
    });
  });

  describe('multiple recipes (article tags)', () => {
    it('parses multiple article-wrapped recipes', () => {
      const html = `
        <article><h1>Recipe One</h1><div class="ingredients"><li>Salt</li></div></article>
        <article><h1>Recipe Two</h1><div class="ingredients"><li>Pepper</li></div></article>
      `;
      const recipes = parsePaprikaHtml(html);
      expect(recipes).toHaveLength(2);
      expect(recipes[0]!.name).toBe('Recipe One');
      expect(recipes[1]!.name).toBe('Recipe Two');
    });

    it('skips articles without a valid name', () => {
      const html = `
        <article><h1>Real Recipe</h1></article>
        <article><p>No title here</p></article>
      `;
      const recipes = parsePaprikaHtml(html);
      expect(recipes).toHaveLength(1);
      expect(recipes[0]!.name).toBe('Real Recipe');
    });
  });

  describe('empty / malformed input', () => {
    it('returns empty array for empty string', () => {
      expect(parsePaprikaHtml('')).toEqual([]);
    });

    it('returns empty array for HTML with no recipe content', () => {
      expect(parsePaprikaHtml('<html><body></body></html>')).toEqual([]);
    });
  });

  // #1062: a crafted export cannot hold the server. Each of these took 0.3 to
  // 3 seconds on 40 to 80 KB with the old regexes; 512 KB must stay fast.
  describe('crafted input', () => {
    const big = 512 * 1024;
    const cases: Array<[string, string]> = [
      ['unclosed h1 tags', '<h1 class="'.repeat(big / 11)],
      ['unclosed divs with classes', '<div class="ingredients'.repeat(big / 23)],
      ['repeated labels with no value', 'prep '.repeat(big / 5)],
      ['a long run of digits after a label', '<h1>x</h1> prep time: ' + '1'.repeat(big)],
      ['a source label with no link', 'source:'.repeat(big / 7)],
      ['unclosed articles', '<article '.repeat(big / 9)],
      ['deeply nested divs', '<h1>Deep</h1><div class="notes">' + '<div>'.repeat(100_000) + 'x'],
    ];
    it.each(cases)('%s parses in well under a second', (_label, html) => {
      const t0 = performance.now();
      parsePaprikaHtml(html);
      expect(performance.now() - t0).toBeLessThan(1000);
    });

    it('refuses markup nested past any real export, and still reads one nested a little', () => {
      expect(parsePaprikaHtml('<h1>Deep</h1>' + '<div>'.repeat(1000))).toEqual([]);
      const nested = parsePaprikaHtml('<h1>Shallow</h1><div class="notes">' + '<div>'.repeat(50) + 'Keep cold');
      expect(nested[0]!.notes).toBe('Keep cold');
      // Unclosed list items are valid HTML and do not count as nesting.
      const list = parsePaprikaHtml('<h1>Long list</h1><div class="ingredients"><ul>' + '<li>salt'.repeat(2000) + '</ul></div>');
      expect(list[0]!.ingredients).toHaveLength(2000);
    });
  });
});
