# Wishes & Gift Ideas

![Wish lists with claim tracking](../demos/wishes.png){ .hero-image }

Per-family-member wish lists with secret claim tracking for gift surprises, plus private gift-idea tracking for the gift-giver side. Built around the family-gift-giving problem: kids and parents want to keep wish lists, but gift-givers also want their own private "what I'm planning to buy" notes that the recipient never sees.

---

## Two tabs, two purposes

The Wishes page has two tabs:

- **My Wishes**: public-within-the-family wish lists. Each family member has their own. Other family members can secretly mark items as purchased.
- **Gift Ideas**: private per-user gift idea tracking for OTHER family members. Only the creator sees their own ideas; recipients never see them.

Same general data shape, different privacy model.

---

## My Wishes

### Per-person wish lists

Each family member has their own list. By default the tab shows a combined flat list of everyone's wishes. Use the **person-filter chip-bar** at the top to narrow to specific members, and the **Group: None / Person** toggle to switch views: **Person** restores the side-by-side per-column layout, one column per family member. In that per-column view the columns themselves can be dragged to reorder (order is remembered locally).

Each item carries:

- **Name** (required)
- **URL**: optional link.
- **Notes**: size, color, model number, "the one from the aquarium gift shop."
- **Added by**: who added it.
- **Claim state**: see below.

### Adding wishes

Every wish is added through the **+ Add wish** modal: tap the **+** in the tab header (or on a person's column in the Person view) to open it, then fill in name, URL, and notes.

Anyone in the family can add items to anyone else's list. Useful when a parent wants to add a gift idea on behalf of a kid who hasn't gotten around to it.

### Claim (secret purchase)

When someone is shopping for another family member's gift, they can **claim** an item from that person's wish list. This is the magic of the system:

- Clicking an item on **another person's** list marks it claimed.
- The claim is **secret from the wish-list owner.** They don't see who claimed what, or even that anything is claimed. The list looks unchanged from their perspective.
- Other family members (the potential gift-givers) see a **"Purchased by {name}"** label, so two people don't accidentally buy Emma the same roller skates.

So the workflow is:

1. Emma adds "Roller skates" to her wish list.
2. Alex sees this when shopping for her birthday, clicks claim. List shows "Purchased by Alex" to everyone except Emma (Alex sees "You purchased this").
3. Jordan sees the "Purchased by Alex" label, knows Alex is handling skates, picks something else.
4. Birthday morning: Emma gets the skates, surprised.

The claim is visible to Alex (who claimed it), Jordan, and Sophie. Not to Emma.

### Cross off (got it myself)

The owner can **cross off** items they got themselves, e.g. Emma bought a book she'd had on her list. The item is marked complete from her perspective.

But here's the catch: **if someone else has already secretly bought it,** crossing it off shows the message *"Someone already got this for you!"*, without revealing who. So Emma can't accidentally undo Alex's gift planning by crossing off skates that Alex secretly already bought.

### Microsoft To Do sync

Each family member's wish list can sync bidirectionally with a Microsoft To Do list. Configure it under *Settings → Integrations → Microsoft card → Wish lists* sub-section (the legacy *?section=wish* URL now redirects there):

- Per-member configuration.
- Pick which MS To Do list maps to that member's wish list.
- Sync covers: name, URL (in notes), claimed status.

Useful if a family member uses MS To Do on their phone, they can add to their wish list from anywhere, and the items flow into Prism.

**Gift Ideas do NOT sync to MS To Do**: privacy protection. We don't want to leak private gift planning into a synced list that might be shared with the recipient.

---

## Gift Ideas

### What it is

Your **private notebook of gift ideas for other family members**. The recipient never sees these. Other family members never see these. Only the creator sees them.

This solves a real problem: you've been keeping a mental note that Emma loves watercolors and would like a fancy art set for her birthday. Where do you write that down? Notes app? Group thread? Each option leaks the surprise. Gift Ideas is the privacy-respecting place to write it down.

### Layout

The Gift Ideas tab shows columns for every OTHER family member. So Alex sees columns for Jordan, Emma, and Sophie (no Alex column). Each column is Alex's private gift-idea list for that person.

Jordan, viewing the same page, sees columns for Alex, Emma, and Sophie, Jordan's own private gift-idea lists.

### Per-idea data

- **Name**: what the gift is.
- **URL**: link to where to buy it.
- **Notes**: size, color, "she mentioned wanting this in December."
- **Price**: record a price per idea.
- **Purchased**: boolean. Set when you've actually bought it.
- **Sort order**.

### Privacy enforcement

The privacy model is enforced at three layers:

1. **UI**: the Gift Ideas tab never shows ideas for yourself (no self-column).
2. **API**: the `/api/gift-ideas` endpoints filter by `created_by = currentUser.id`. You only ever get ideas you created.
3. **MS To Do sync**: gift ideas are excluded from all external sync. They live only in Prism.

If a child opened Prism with their PIN and went to the Gift Ideas tab, they'd see THEIR ideas for OTHER people. They would not see what their parents have been planning for them. Same goes for any family member.

### Marking purchased

When you actually buy the gift, mark the idea **purchased**. This keeps the idea in your list (so you remember what you bought) but visually distinguishes "still planning" from "done."

Purchased ideas stay in the column but are shown dimmed and struck-through, so "still planning" reads clearly apart from "done."

### Data refresh on user switch

The Gift Ideas tab refreshes data immediately when a user switches login. This is intentional, without the refresh you might briefly see the previous user's stale data in the tab while their cache lingered. Was a confusing privacy quirk in early versions; fixed in v1.1.

---

## Use cases

### Birthday planning

Three months before Emma's birthday: parents add gift ideas to Gift Ideas (private). Emma adds wishes to her wish list (public-within-family). Parents claim from her wish list secretly + browse their own gift ideas. Birthday morning: everyone's happy.

### Holiday season

Same pattern at higher volume. Track ideas + purchased status as you shop, and record a price on each idea as you go.

### Coordinating with extended family

Pin Grandma's gift idea ("she mentioned wanting a new tea kettle") in your Gift Ideas. Share with relatives who are coordinating Christmas if needed, but always via Prism, never via group text where the recipient might glimpse it.

### Self-purchase

Sometimes you buy something you'd put on your own wish list. Cross it off. If someone else already claimed it, Prism warns you so you don't accidentally end up with two. Otherwise, just a clean strike-through.

---

## Privacy summary

| Data | Owner sees | Other family sees | External sync |
|---|---|---|---|
| Wish list items | Yes | Yes | MS To Do (per-member opt-in) |
| Claim status (someone secretly bought it) | **No** | Yes (with claimer name) | Not synced |
| Gift Ideas (your private list) | Yes (only the creator) | **No** | **Not synced** |
| Purchased status on Gift Ideas | Yes (only the creator) | No | Not synced |

The two crucial privacy invariants:

1. Wish-list owner never sees claims on their own list.
2. Gift Ideas never escape the creator's account.

---

## Troubleshooting

### Owner can see who claimed an item

Bug. File an issue. The intended behavior is: the owner sees their list looking unclaimed regardless of actual claim state.

### Gift Idea showed up for someone else

Privacy violation. File an issue immediately. The API filter on `created_by` should prevent this; if it doesn't, that's a serious bug.

### "Someone already got this for you" appeared on an unclaimed item

The claim system uses the `claimed` flag. Check the database row directly. Was claimed unexpectedly set? Could happen if a claim was made and the user later denied claiming it; the state should clear when they unclaim.

### Wish list sync to MS To Do creates duplicates

Usually a one-time glitch from racing wish creation in both places before first sync. Delete the duplicate; the deletion syncs.

### Cross-off undid itself when synced

The MS To Do side marked the corresponding task incomplete, and newest-wins resolution flipped your cross-off back. Cross off again from Prism, or fix on the MS To Do side.

### Self-column showing in Gift Ideas

You shouldn't see a column for yourself in Gift Ideas: that defeats the privacy model. If you do, file an issue with your user setup.

### Bought a gift through Gift Ideas but the wish list still shows unclaimed

Gift Ideas and wish-list claims are separate systems. Marking a gift idea purchased doesn't auto-claim the matching wish item. (Should it? Possible future enhancement.) For now, manually claim the wish item too.
