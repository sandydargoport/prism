# Birthdays & Milestones

The Birthdays widget shows upcoming birthdays, anniversaries and milestones, with
how many days away each one is and how old the person is turning.

**You don't type birthdays into Prism.** It reads them from the calendars and
contacts you already keep, so they stay correct in one place rather than two.

## Where they come from

| Source | What Prism reads |
|---|---|
| Any connected calendar | All-day events with **birthday** or **anniversary** in the title |
| iCloud / CardDAV contacts | The birthday field on your contact cards |
| Google Contacts | Google's own generated birthday calendar |

Calendars of every kind are scanned — Google, iCloud/CalDAV, iCal subscriptions,
and calendars created inside Prism itself.

!!! tip "iPhone birthdays"
    iCloud contacts are CardDAV, so the birthdays saved against contacts on your
    phone come straight through. Tick **contact birthdays** when connecting
    iCloud under *Settings → Integrations*.

## Adding one Prism can't find

Give it a source: put the birthday on a calendar, and Prism picks it up on the
next sync. Your own local Prism calendar is fine for this — you don't need an
external account.

1. Create an **all-day** event on the birthday. A timed event is read as
   something happening *near* a birthday rather than the birthday itself.
2. Title it with the person's name and the word **birthday**:
   `Grandma's Birthday`
3. Optionally add the year in brackets to show their age:
   `Grandma's Birthday (1948)`

Without a year you still get the date and the countdown, just no age.

## Anniversaries and milestones

**Anniversaries** work the same way — put **anniversary** in the title.

**Milestones** have no obvious keyword, so Prism looks for the shape instead: an
all-day event that **repeats every year** and carries a **year** in the title.

```
Ana and Ben (2005)     ✅ milestone
Moved into the house     ❌ no year, so it's just an event
```

If you keep a calendar where *everything* on it is a life event, open
**Manage calendars** and turn on **"Treat every all-day event here as a birthday
or milestone"**. Titles on that calendar then need no keyword at all.

## Other languages

Titles are matched in English and German — `Geburtstag`, `Hochzeitstag` and
`Jubiläum` all work. Adding another language is a one-line change in
`src/lib/services/birthday-detect.ts`; contributions welcome.

## Removing one

Deleting a birthday in Prism keeps it deleted. It won't come back on the next
sync even though the calendar event still exists, so you can prune the list
without editing the underlying calendar. Delete the calendar event too if you
want it gone everywhere.

## What Prism deliberately ignores

- **Read-only calendars you subscribe to** — school terms, public holidays and
  the like. This is what stops "No School — Martin Luther King's Birthday"
  becoming a family birthday.
- **Events happening near a birthday** — "birthday party", "prep for Sam's
  birthday", "birthday dinner". These describe the celebration, not the day.

If a birthday you expect is missing, check the event is all-day and that its
calendar isn't a read-only subscription.
