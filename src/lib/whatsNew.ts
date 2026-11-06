/**
 * What moved in this release, and where it went (#1032). Shown once per screen
 * after the update and kept in Help. Bump `id` for a later release's list.
 */
export const WHATS_NEW = {
  id: '2026-11-new-look',
  title: "What's new",
  items: [
    { what: 'Pages', where: 'are in the dock at the bottom. More holds the rest, with Settings and Help at the top.' },
    { what: 'Chores', where: "open on what's due. The switches, points, categories and History are under Manage." },
    { what: 'Shopping', where: 'is one calm list. Tap an item for Edit and Delete; ticked items fold into Checked off.' },
    { what: 'Calendar', where: 'is calmer. Manage calendars is in the View menu.' },
    { what: 'The front page', where: 'can be Simple (today at a glance) or Custom (your grid of widgets): Settings, Appearance, Front page. Your layouts are unchanged.' },
    { what: 'On a phone,', where: 'the round button at the bottom right adds on each page; on the dashboard it holds the dashboard options.' },
    { what: 'In the editor,', where: 'Delete removes the selected widget, and the arrow keys move it, or resize it in resize mode.' },
  ],
} as const;

/** Per screen: the id of the last list seen here. */
export const WHATS_NEW_SEEN_KEY = 'prism-whats-new-seen';

export function markWhatsNewSeen(): void {
  try { localStorage.setItem(WHATS_NEW_SEEN_KEY, WHATS_NEW.id); } catch { /* shown again next time */ }
}

export function whatsNewUnseen(): boolean {
  try { return localStorage.getItem(WHATS_NEW_SEEN_KEY) !== WHATS_NEW.id; } catch { return false; }
}
