/**
 * What is new in this release (#1032, #1308). Shown once per screen after the
 * update and kept in Help. Bump `id` for a later release's list, so every
 * screen that saw the last one sees this one once.
 *
 * Each item is one string; the words between ** are drawn bold.
 */
export const WHATS_NEW = {
  id: '2026-11-new-look-2',
  title: "What's new in Prism",
  changelog: 'https://sandydargoport.github.io/prism/CHANGELOG/',
  items: [
    "**Glance, a new front page layout.** The clock, the weather, what's next and the coming days, written as sentences over your photos. To use it: More > Edit layout > Dashboard > Glance > Make the default. Your own dashboards are unchanged.",
    '**Navigation is at the bottom of the screen.** Your main pages sit in a bar along the bottom. Its **More** button opens the other pages, Settings and Help.',
    '**Each screen is set up on the screen itself.** More > Edit layout > Through the day chooses what the screen shows when nobody is using it and at night, and when it switches to another dashboard. From your phone: More > Settings > Screens > Edit.',
    '**Photos fade from one to the next and slowly zoom**, and can show when and where they were taken: More > Settings > Appearance.',
    '**Users can now set alphanumeric PINs** of letters and numbers: More > Settings > Family Members.',
    '**Chores for pets**, and **subtasks** from Google Tasks and steps from Microsoft To Do.',
    "**Tandoor and Mealie sync both ways**, after you review what's sent.",
  ],
} as const;

/** An item as runs of text, bold or not, in order. */
export function whatsNewRuns(item: string): Array<{ text: string; bold: boolean }> {
  return item
    .split('**')
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((r) => r.text !== '');
}

/** Per screen: the id of the last list seen here. */
export const WHATS_NEW_SEEN_KEY = 'prism-whats-new-seen';

export function markWhatsNewSeen(): void {
  try { localStorage.setItem(WHATS_NEW_SEEN_KEY, WHATS_NEW.id); } catch { /* shown again next time */ }
}

export function whatsNewUnseen(): boolean {
  try { return localStorage.getItem(WHATS_NEW_SEEN_KEY) !== WHATS_NEW.id; } catch { return false; }
}
