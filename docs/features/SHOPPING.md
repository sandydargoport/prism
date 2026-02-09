# Shopping Lists

## Overview
Shopping lists support both grocery-style category layouts and simple two-column layouts for hardware/other lists.

## List Types

### Grocery Lists
- 6-category grid: produce, bakery, meat, dairy, frozen, pantry
- Categories color-coded with emoji headers
- Drag-to-reorder categories (grip icon)
- Category order persisted in localStorage

### Hardware/Other Lists
- 2-column layout: "List 1" (blue), "List 2" (purple)
- Same card styling as grocery categories
- Items split evenly between columns

## Layout

### Grid Responsiveness
- **Landscape**: 3 columns for grocery, 2 for other
- **Portrait**: 2 columns for both types

### Category Cards
- Colored border matching category theme
- Emoji + category name header
- Item count badge
- Add button (+) in header
- Notebook-line styling

### Empty Rows
- Base: 6 empty lines per category
- +1/-1/+5 buttons to adjust
- Minimum 1 empty line

## Item Interaction

### Adding Items
- Click + button in category header
- Opens modal with category pre-selected
- Or use inline text input (press Enter or blur to add)
- Requires authentication prompt

### Inline Input
- Text field in each category
- Press Enter to add item
- Blur (tap elsewhere) also adds item
- Category auto-assigned

### Toggling Items
- Tap item row to strikethrough
- No checkboxes (cleaner mobile UX)
- Strikethrough indicates checked

### Editing/Deleting
- Swipe or long-press for actions
- Edit opens modal with current values
- Delete removes immediately

## Shopping Mode

### Activation
- Maximize button (expand icon) in header
- Full-screen mobile experience

### Compact Header
- List name + progress badge
- Small progress bar
- Minimize button to exit

### Hidden Elements
- List tabs hidden
- Filter buttons hidden
- Maximum screen space for items

## Progress Tracking

### Progress Bar
- Shows checked/total items
- Percentage display
- Updates in real-time

### Celebration Animation
When all items checked:
- Shopping cart animation across screen
- Kid riding in cart with arms up
- Confetti exhaust particles
- "All Done!" bounce text
- Auto-dismisses after 3 seconds

## Category Reordering

### Drag and Drop
- Grab grip icon (⋮⋮) on category header
- Drag to new position
- Visual feedback: dragged category fades
- Drop to confirm new order

### Persistence
- Order saved to localStorage
- Key: `prism:grocery-category-order`
- Survives page refresh

## Microsoft To-Do Sync

### Configuration
- Settings → Shopping Integrations
- Connect MS To-Do via OAuth
- Select which MS list to sync

### Sync Behavior
- Bidirectional newest-wins
- Shopping items become MS To-Do tasks
- Checked items sync as completed tasks
- Manual sync button or auto-sync

## Files
- `src/app/shopping/ShoppingView.tsx` - Main page
- `src/app/shopping/useShoppingViewData.ts` - Data hook
- `src/app/shopping/ShoppingItemRow.tsx` - Item component
- `src/app/shopping/ShoppingCelebration.tsx` - Celebration animation
- `src/app/shopping/ItemModal.tsx` - Add/edit item
- `src/app/shopping/ListModal.tsx` - Add/edit list
- `src/lib/hooks/useShoppingLists.ts` - Lists data hook
- `src/lib/hooks/useShoppingListSources.ts` - Sync sources
