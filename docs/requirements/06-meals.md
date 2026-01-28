### 5. Meal Planning (Hybrid Model)

#### Internal Meal List (V1.0)
**Simple Weekly Meal List:**
- List of meals planned for the week
- Optional: Assign to specific days
- Check off as cooked
- Reset weekly (Sunday)
- Notes field (e.g., "prep veggies night before")
- Recipe link field (optional)

**Meal Structure:**
```typescript
interface Meal {
  id: string;
  name: string;
  day?: string; // Optional: 'monday', 'tuesday', etc., or null
  recipeUrl?: string;
  notes?: string;
  cooked: boolean;
  cookedDate?: Date;
  source: 'internal' | 'paprika';
  sourceId?: string;
  weekOf: Date; // Week this meal is planned for
  createdBy: string;
}
```

#### Meal Widget
```
┌─ THIS WEEK'S MEALS ────────────┐
│ Monday                         │
│   ☑️ Spaghetti & meatballs      │
│ Tuesday                        │
│   ⬜ Chicken tacos              │
│ Wednesday                      │
│   ⬜ Salmon with roasted veggies│
│ Thursday - Sunday              │
│   ⬜ Pizza (takeout)            │
│   ⬜ Grilled burgers            │
│   ⬜ Leftovers buffet           │
│                                │
│ Not assigned to specific days: │
│   ⬜ Pasta primavera            │
└────────────────────────────────┘
```

#### Features
- **Day Assignment:** Optional - can just list meals for the week
- **Quick Add:** Add meal name and optional day
- **Reorder:** Drag to reassign days
- **Recipe Links:** Click to open recipe
- **Shopping Integration:** Optionally add ingredients to shopping list
- **Meal History:** See what you cooked last week/month

#### Paprika Integration (Phase 2)
- **Full Recipe Import:** Import recipes from Paprika
- **Meal Plans:** Sync Paprika meal plans
- **Grocery List Sync:** Import Paprika grocery list to shopping list
- **Pantry Management:** Track what's in stock
- **Authentication:** Paprika API (documentation limited, may require reverse engineering)
