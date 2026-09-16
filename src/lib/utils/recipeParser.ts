/**
 * Recipe URL Parser
 *
 * Parses recipe data from URLs using schema.org Recipe JSON-LD markup.
 * Most popular recipe sites (AllRecipes, Food Network, Serious Eats, etc.)
 * use this structured data format.
 *
 * Reference: https://schema.org/Recipe
 */

import { safeFetch, validatePublicUrl, UnsafeUrlError } from './safeFetch';

export interface ParsedRecipe {
  name: string;
  description?: string;
  url: string;
  imageUrl?: string;
  ingredients: Array<{ text: string }>;
  instructions?: string;
  prepTime?: number; // minutes
  cookTime?: number; // minutes
  totalTime?: number; // minutes
  servings?: number;
  cuisine?: string;
  category?: string;
  author?: string;
}

interface SchemaOrgRecipe {
  '@type': 'Recipe' | string[];
  name?: string;
  description?: string;
  image?: string | string[] | { url: string }[];
  recipeIngredient?: string[];
  recipeInstructions?: string | string[] | Array<{ '@type': string; text?: string; name?: string }>;
  prepTime?: string; // ISO 8601 duration (e.g., "PT30M")
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number;
  recipeCuisine?: string | string[];
  recipeCategory?: string | string[];
  author?: string | { name?: string } | Array<{ name?: string }>;
}

/**
 * Parse ISO 8601 duration to minutes.
 * Examples: "PT30M" = 30, "PT1H30M" = 90, "PT2H" = 120
 */
function parseDuration(duration: unknown): number | undefined {
  if (!duration || typeof duration !== 'string') return undefined;

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) return undefined;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 60 + minutes + Math.round(seconds / 60);
}

/**
 * Extract servings from recipeYield.
 * Examples: "4 servings" = 4, "Makes 6" = 6, "8" = 8
 */
function parseServings(yield_: unknown): number | undefined {
  if (yield_ === undefined || yield_ === null) return undefined;
  if (typeof yield_ === 'number') return yield_;
  if (typeof yield_ !== 'string') return undefined;

  const match = yield_.match(/(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : undefined;
}

/**
 * Extract image URL from various schema.org formats.
 */
function parseImage(image: unknown): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'url' in first && typeof (first as { url: unknown }).url === 'string') {
      return (first as { url: string }).url;
    }
  }
  if (typeof image === 'object' && 'url' in image && typeof (image as { url: unknown }).url === 'string') {
    return (image as { url: string }).url;
  }
  return undefined;
}

/**
 * Parse instructions from various formats into a single string.
 */
function parseInstructions(instructions: unknown): string | undefined {
  if (!instructions) return undefined;

  if (typeof instructions === 'string') {
    return instructions;
  }

  if (Array.isArray(instructions)) {
    return instructions
      .map((step, index) => {
        if (typeof step === 'string') {
          return `${index + 1}. ${step}`;
        }
        if (step && typeof step === 'object') {
          const obj = step as { text?: unknown; name?: unknown };
          const text = (typeof obj.text === 'string' ? obj.text : '') ||
                       (typeof obj.name === 'string' ? obj.name : '');
          return text ? `${index + 1}. ${text}` : '';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
  }

  return undefined;
}

/**
 * Parse author from various formats.
 */
function parseAuthor(author: unknown): string | undefined {
  if (!author) return undefined;
  if (typeof author === 'string') return author;
  if (Array.isArray(author)) {
    const first = author[0];
    if (first && typeof first === 'object' && 'name' in first) {
      const name = (first as { name: unknown }).name;
      return typeof name === 'string' ? name : undefined;
    }
  }
  if (typeof author === 'object' && 'name' in author) {
    const name = (author as { name: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
}

/**
 * Extract first value from string or array.
 */
function firstValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

/**
 * Find schema.org Recipe JSON-LD in HTML.
 */
function findRecipeJsonLd(html: string): SchemaOrgRecipe | null {
  // Find all JSON-LD script tags
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    const jsonContent = match[1];
    if (!jsonContent) continue;

    try {
      const data = JSON.parse(jsonContent);

      // Could be a single object or an array
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        // Check if this is a Recipe
        if (item['@type'] === 'Recipe') {
          return item;
        }

        // Check if @type is an array containing 'Recipe'
        if (Array.isArray(item['@type']) && item['@type'].includes('Recipe')) {
          return item;
        }

        // Check @graph for Recipe
        if (item['@graph'] && Array.isArray(item['@graph'])) {
          for (const graphItem of item['@graph']) {
            if (graphItem['@type'] === 'Recipe') {
              return graphItem;
            }
            if (Array.isArray(graphItem['@type']) && graphItem['@type'].includes('Recipe')) {
              return graphItem;
            }
          }
        }
      }
    } catch {
      // Invalid JSON, continue to next script tag
    }
  }

  return null;
}

/**
 * Fetch a URL and parse recipe data from schema.org markup.
 *
 * @param url - The recipe URL to parse
 * @returns Parsed recipe data or null if no recipe found
 * @throws Error if fetch fails or URL is blocked
 */
export async function parseRecipeFromUrl(url: string): Promise<ParsedRecipe | null> {
  // Validate up front so the caller keeps the specific messages the UI shows,
  // then let safeFetch re-validate every redirect hop below.
  try {
    validatePublicUrl(url, { isProduction: true });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      if (err.message.includes('not parseable') || err.message.includes('URL is required')) {
        throw new Error('Invalid URL');
      }
      if (err.message.includes('Protocol')) {
        throw new Error('Only HTTP/HTTPS URLs are supported');
      }
      throw new Error('URL points to a blocked address');
    }
    throw err;
  }

  // URL validation and redirect safety are delegated to safeFetch. This used
  // to be a hand-rolled hostname blocklist, which drifted from the shared guard
  // in two ways that mattered: it was missing the CGNAT (100.64.0.0/10) and
  // IPv4-mapped-IPv6 ranges, and it validated only the URL the user supplied.
  // The fetch below then followed redirects, so a public URL that 302'd to an
  // internal address bypassed the check entirely.

  // Fetch the page — try plain fetch first, fall back to headless browser on 403
  let html: string;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await safeFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
    }, { isProduction: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Failed to fetch URL: request timed out');
    }
    // Keep the guard's own message: it names which hop was refused, which is
    // the difference between "that site is down" and "that site redirected
    // somewhere it should not".
    if (err instanceof UnsafeUrlError) {
      throw new Error(`URL points to a blocked address: ${err.message}`);
    }
    throw new Error(`Failed to fetch URL: ${err instanceof Error ? err.message : 'network error'}`);
  } finally {
    clearTimeout(timeout);
  }

  if (response.ok) {
    html = await response.text();
  } else if (response.status === 403) {
    // Cloudflare bot protection — try headless browser fallback
    const { browserFetch } = await import('./browserFetch');
    const browserHtml = await browserFetch(url);
    if (!browserHtml) {
      throw new Error(`Failed to fetch URL: 403 Forbidden (headless browser not available)`);
    }
    html = browserHtml;
  } else {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  // Find and parse recipe JSON-LD
  const recipeData = findRecipeJsonLd(html);

  if (!recipeData) {
    return null;
  }

  // Extract and normalize data
  const recipe: ParsedRecipe = {
    name: recipeData.name || 'Untitled Recipe',
    url,
    ingredients: (recipeData.recipeIngredient || []).map((text) => ({ text })),
  };

  if (recipeData.description) {
    recipe.description = recipeData.description;
  }

  const imageUrl = parseImage(recipeData.image);
  if (imageUrl) {
    recipe.imageUrl = imageUrl;
  }

  const instructions = parseInstructions(recipeData.recipeInstructions);
  if (instructions) {
    recipe.instructions = instructions;
  }

  const prepTime = parseDuration(recipeData.prepTime);
  if (prepTime) {
    recipe.prepTime = prepTime;
  }

  const cookTime = parseDuration(recipeData.cookTime);
  if (cookTime) {
    recipe.cookTime = cookTime;
  }

  const totalTime = parseDuration(recipeData.totalTime);
  if (totalTime) {
    recipe.totalTime = totalTime;
  }

  const servings = parseServings(recipeData.recipeYield);
  if (servings) {
    recipe.servings = servings;
  }

  const cuisine = firstValue(recipeData.recipeCuisine);
  if (cuisine) {
    recipe.cuisine = cuisine;
  }

  const category = firstValue(recipeData.recipeCategory);
  if (category) {
    recipe.category = category;
  }

  const author = parseAuthor(recipeData.author);
  if (author) {
    recipe.author = author;
  }

  return recipe;
}

export default parseRecipeFromUrl;
