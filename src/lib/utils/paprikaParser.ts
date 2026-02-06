/**
 * Paprika HTML Export Parser
 *
 * Parses recipe data from Paprika 3's HTML export format.
 * Paprika exports recipes as HTML files with structured content.
 */

export interface PaprikaRecipe {
  name: string;
  description?: string;
  ingredients: Array<{ text: string }>;
  instructions?: string;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  servings?: number;
  source?: string;
  sourceUrl?: string;
  categories?: string[];
  imageUrl?: string;
  notes?: string;
  rating?: number;
}

/**
 * Parse time string to minutes.
 * Examples: "30 min", "1 hr 30 min", "2 hours", "45 minutes"
 */
function parseTimeString(timeStr: string | undefined): number | undefined {
  if (!timeStr) return undefined;

  let totalMinutes = 0;

  // Match hours
  const hoursMatch = timeStr.match(/(\d+)\s*(?:hr|hour)/i);
  if (hoursMatch && hoursMatch[1]) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60;
  }

  // Match minutes
  const minutesMatch = timeStr.match(/(\d+)\s*(?:min)/i);
  if (minutesMatch && minutesMatch[1]) {
    totalMinutes += parseInt(minutesMatch[1], 10);
  }

  return totalMinutes > 0 ? totalMinutes : undefined;
}

/**
 * Parse servings from string.
 * Examples: "4 servings", "Serves 6", "Makes 12"
 */
function parseServingsString(servingsStr: string | undefined): number | undefined {
  if (!servingsStr) return undefined;

  const match = servingsStr.match(/(\d+)/);
  return match && match[1] ? parseInt(match[1], 10) : undefined;
}

/**
 * Parse rating from string or stars.
 * Examples: "4 stars", "★★★★☆", "3/5"
 */
function parseRating(ratingStr: string | undefined): number | undefined {
  if (!ratingStr) return undefined;

  // Count filled stars
  const filledStars = (ratingStr.match(/★/g) || []).length;
  if (filledStars > 0) {
    return filledStars;
  }

  // Parse "X stars" format
  const starsMatch = ratingStr.match(/(\d+)\s*star/i);
  if (starsMatch && starsMatch[1]) {
    return parseInt(starsMatch[1], 10);
  }

  // Parse "X/5" format
  const fractionMatch = ratingStr.match(/(\d+)\s*\/\s*5/);
  if (fractionMatch && fractionMatch[1]) {
    return parseInt(fractionMatch[1], 10);
  }

  return undefined;
}

/**
 * Extract text content from HTML element, handling nested tags.
 */
function extractText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse a single recipe from Paprika HTML content.
 */
function parseRecipeSection(html: string): PaprikaRecipe | null {
  // Try to find recipe name
  const nameMatch = html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                    html.match(/<title>([\s\S]*?)<\/title>/i);

  const nameContent = nameMatch?.[1];
  const name = nameContent ? extractText(nameContent) : 'Untitled Recipe';

  if (!name || name === 'Untitled Recipe') {
    return null;
  }

  const recipe: PaprikaRecipe = {
    name,
    ingredients: [],
  };

  // Description
  const descMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const descContent = descMatch?.[1];
  if (descContent) {
    recipe.description = extractText(descContent);
  }

  // Ingredients - look for ingredient list/section
  const ingredientsMatch = html.match(/<div[^>]*class="[^"]*ingredients?[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                           html.match(/<section[^>]*class="[^"]*ingredients?[^"]*"[^>]*>([\s\S]*?)<\/section>/i);

  const ingredientHtml = ingredientsMatch?.[1];
  if (ingredientHtml) {
    // Split by list items or newlines
    const ingredientLines = ingredientHtml
      .split(/<li[^>]*>/i)
      .map(extractText)
      .filter(line => line.trim().length > 0);

    recipe.ingredients = ingredientLines.map(text => ({ text }));
  } else {
    // Fallback: look for lines after "Ingredients" heading
    const afterIngredients = html.match(/ingredients[:\s]*<\/h\d>[\s\S]*?(<ul[^>]*>[\s\S]*?<\/ul>)/i);
    const ulContent = afterIngredients?.[1];
    if (ulContent) {
      const items = ulContent.split(/<li[^>]*>/i).map(extractText).filter(Boolean);
      recipe.ingredients = items.map(text => ({ text }));
    }
  }

  // Instructions/Directions
  const instructionsMatch = html.match(/<div[^>]*class="[^"]*(?:instructions?|directions?)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                            html.match(/<section[^>]*class="[^"]*(?:instructions?|directions?)[^"]*"[^>]*>([\s\S]*?)<\/section>/i);

  const instructionsContent = instructionsMatch?.[1];
  if (instructionsContent) {
    recipe.instructions = extractText(instructionsContent);
  }

  // Prep time
  const prepMatch = html.match(/prep(?:\s*time)?[:\s]*([^<]+)/i);
  if (prepMatch?.[1]) {
    recipe.prepTime = parseTimeString(prepMatch[1]);
  }

  // Cook time
  const cookMatch = html.match(/cook(?:\s*time)?[:\s]*([^<]+)/i);
  if (cookMatch?.[1]) {
    recipe.cookTime = parseTimeString(cookMatch[1]);
  }

  // Total time
  const totalMatch = html.match(/total(?:\s*time)?[:\s]*([^<]+)/i);
  if (totalMatch?.[1]) {
    recipe.totalTime = parseTimeString(totalMatch[1]);
  }

  // Servings
  const servingsMatch = html.match(/(?:servings?|serves|makes)[:\s]*([^<]+)/i);
  if (servingsMatch?.[1]) {
    recipe.servings = parseServingsString(servingsMatch[1]);
  }

  // Source URL
  const sourceUrlMatch = html.match(/(?:source|original)[:\s]*<a[^>]*href="([^"]+)"/i);
  if (sourceUrlMatch?.[1]) {
    recipe.sourceUrl = sourceUrlMatch[1];
  }

  // Source name
  const sourceMatch = html.match(/source[:\s]*([^<]+)/i);
  const sourceContent = sourceMatch?.[1];
  if (sourceContent && !sourceContent.includes('http')) {
    recipe.source = extractText(sourceContent);
  }

  // Categories
  const categoriesMatch = html.match(/categor(?:y|ies)[:\s]*([^<]+)/i);
  const categoriesContent = categoriesMatch?.[1];
  if (categoriesContent) {
    recipe.categories = categoriesContent
      .split(/[,;]/)
      .map(c => c.trim())
      .filter(Boolean);
  }

  // Image
  const imageMatch = html.match(/<img[^>]*class="[^"]*recipe[^"]*"[^>]*src="([^"]+)"/i) ||
                     html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*recipe[^"]*"/i) ||
                     html.match(/<img[^>]*src="(data:image[^"]+)"/i);
  if (imageMatch?.[1]) {
    recipe.imageUrl = imageMatch[1];
  }

  // Notes
  const notesMatch = html.match(/<div[^>]*class="[^"]*notes?[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const notesContent = notesMatch?.[1];
  if (notesContent) {
    recipe.notes = extractText(notesContent);
  }

  // Rating
  const ratingMatch = html.match(/rating[:\s]*([^<]+)/i) ||
                      html.match(/class="[^"]*rating[^"]*"[^>]*>([^<]+)/i);
  if (ratingMatch?.[1]) {
    recipe.rating = parseRating(ratingMatch[1]);
  }

  return recipe;
}

/**
 * Parse Paprika HTML export which may contain multiple recipes.
 *
 * @param html - The HTML content from a Paprika export
 * @returns Array of parsed recipes
 */
export function parsePaprikaHtml(html: string): PaprikaRecipe[] {
  const recipes: PaprikaRecipe[] = [];

  // Paprika exports can have multiple recipes as separate articles/sections
  const articleMatches = html.match(/<article[^>]*>[\s\S]*?<\/article>/gi);

  if (articleMatches && articleMatches.length > 0) {
    for (const article of articleMatches) {
      const recipe = parseRecipeSection(article);
      if (recipe) {
        recipes.push(recipe);
      }
    }
  } else {
    // Single recipe or different structure - try to parse the whole thing
    const recipe = parseRecipeSection(html);
    if (recipe) {
      recipes.push(recipe);
    }
  }

  return recipes;
}

export default parsePaprikaHtml;
