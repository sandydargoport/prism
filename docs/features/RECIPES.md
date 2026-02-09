# Recipes System

## Overview
Full recipe management with import capabilities, ingredient scaling, and meal planning integration.

## Recipe Properties
- Name (required)
- Description
- Ingredients (JSON array or text)
- Instructions
- Prep time, cook time (minutes)
- Servings
- Cuisine (e.g., Italian, Mexican)
- Category (e.g., Main Course, Dessert)
- Image URL
- Notes
- Is Favorite (boolean)
- Times Made (counter)

## Recipe Page

### Grid View
- Recipe cards with images
- Name, cuisine, category labels
- Cook time indicator
- Favorite heart icon

### Filtering
- Search by name
- Filter by cuisine dropdown
- Filter by category dropdown
- Favorites only toggle
- "Clear filters" button

## Recipe Import

### URL Import
- Paste recipe URL
- Parses schema.org Recipe JSON-LD
- Works with ~80% of recipe sites
- Extracts: name, ingredients, instructions, times, image

### Paprika Import
- Import from Paprika HTML export
- Paste HTML content
- Parses Paprika's format

### Manual Entry
- Full form for all fields
- Ingredient list textarea
- Instructions textarea

## Recipe Detail Modal

### Header
- Recipe name
- Cuisine and category badges
- Prep/cook time
- Favorite toggle
- Maximize button (full-screen)

### Servings Scaling
- +/- buttons to adjust servings
- Ingredients auto-scale with smart fractions
- "(scaled up/down)" indicator

### Ingredients
- Click to strikethrough while cooking
- Strikethrough resets on modal close
- Scaled quantities displayed

### Instructions
- Step-by-step display
- From recipe instructions field

### Add to Shopping List
- Dropdown to select list
- Adds scaled ingredients
- Confirmation message

## Meal Integration

### Linking Recipes to Meals
- Recipe picker in Meal modal
- Searchable dropdown
- Shows name, cuisine, category, time
- Selecting auto-fills meal fields

### Auto-Fill Fields
- Meal name from recipe name
- Description from recipe description
- Prep/cook times
- Recipe URL link

## Files
- `src/app/recipes/RecipesView.tsx` - Main page (lazy-loaded)
- `src/app/recipes/page.tsx` - Page wrapper
- `src/lib/hooks/useRecipes.ts` - Data hook
- `src/lib/utils/recipeParser.ts` - Schema.org parser
- `src/lib/utils/paprikaParser.ts` - Paprika parser
- `src/app/api/recipes/route.ts` - CRUD endpoints
- `src/app/api/recipes/import-url/route.ts` - URL import
- `src/app/api/recipes/import-paprika/route.ts` - Paprika import
