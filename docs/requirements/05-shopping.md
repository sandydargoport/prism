### 4. Shopping List (Hybrid Model)

#### Internal Shopping List (Primary)
**Features:**
- Add, edit, delete items
- Categories (Produce, Dairy, Meat, Pantry, etc.)
- Quantity and units
- Check off items
- Uncheck to add back to list
- Multiple lists (Grocery, Hardware, Pharmacy)
- Share list via QR code (for mobile access in store)
- **List Assignment:** Assign lists to specific family members or leave unassigned for "All Family"
  - When assigned to a specific user, only that user (or parents) can check off items
  - Unassigned lists allow any family member to check items
  - Anyone can add items to any list (no restrictions on adding)

**Implementation Status:**
- ✅ Add/edit/delete items on existing lists
- ✅ Check/uncheck items with permission enforcement
- ✅ Database schema supports `assignedTo` field on lists
- ✅ API supports list assignment
- ❌ **TODO:** UI to create new shopping lists
- ❌ **TODO:** UI to assign/edit list ownership

**List Structure:**
```typescript
interface ShoppingList {
  id: string;
  name: string; // "Grocery", "Target", "Hardware", etc.
  sortOrder: number;
  assignedTo?: string | 'all'; // User ID or 'all' for family-wide
  createdAt: Date;
  items: ShoppingItem[];
}
```

**Item Structure:**
```typescript
interface ShoppingItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string; // lbs, oz, count, etc.
  category: string;
  listId: string; // Which list (grocery, hardware, etc.)
  checked: boolean;
  addedBy: string;
  source: 'internal' | 'anylist' | 'bring';
  sourceId?: string;
  notes?: string;
  recurring?: boolean; // Auto-add weekly/monthly
  createdAt: Date;
}
```

#### Shopping List Display
- **Widget:** "Shopping List" showing unchecked items
- **Dedicated Page:** Full list organized by grocery store location
- **Store Layout Categories:**
  - 🥬 Produce (fruits, vegetables)
  - 🥩 Meat & Seafood
  - 🧀 Dairy & Refrigerated
  - ❄️ Frozen Foods
  - 🥫 Pantry & Canned Goods
  - 🍞 Bakery
  - 🌮 Ethnic Foods (Asian, Latin, etc.)
  - 🧴 Health & Beauty
  - 🧹 Household & Cleaning
  - 🐕 Pet Supplies
  - 🍷 Beverages & Alcohol
  - 🍪 Snacks & Candy
  - Other

**Smart Features:**
- **Auto-Categorization:** Items automatically assigned to categories based on name
- **Learning:** System learns from manual category changes
- **Custom Order:** Reorder categories to match your store's layout
- **Quick Add:**
  - **Voice-to-Text (Critical Feature):** Tap microphone icon, speak item
  - Works via browser Web Speech API (no backend needed)
  - Example: "Milk, apples, chicken breast, tortillas"
  - System parses and categorizes automatically
- **Alexa Integration (Optional):**
  - "Alexa, add milk to my shopping list"
  - "Alexa, add eggs and bread to my shopping list"
  - Alexa skill sends items to dashboard API
  - Items automatically categorized

**Shopping Experience:**
- Categories collapse/expand
- Check off items as you shop
- Unchecked items move to top
- "Smart Shop" mode: Reorder by your typical store path
- Share list QR code for in-store mobile access

#### Mobile Access
- **QR Code:** Display QR code that opens mobile-friendly list
- **Responsive:** Works on phone browser
- **Real-time Sync:** Check off items on phone, updates dashboard

#### Future Integrations (Architecture Ready)
- **AnyList** (has API)
- **Bring!** (has API)
- **Google Keep** (unofficial API)
- **Apple Reminders** (shopping list)
- **Mariano's** (if API becomes available - research needed)
- **Out of Milk**
