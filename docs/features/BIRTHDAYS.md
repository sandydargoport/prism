# Birthdays

The Birthdays widget shows upcoming birthdays, anniversaries and milestones, with
how many days away each one is and how old the person is turning.

You don't type birthdays into Prism. It reads them from the calendars and
contacts you already keep, so you only ever keep them up to date in one place.

## Set it up

### Where they come from

| Source | What Prism reads |
|---|---|
| Any connected calendar | All-day events with **birthday** or **anniversary** in the title |
| iCloud / CardDAV contacts | The birthday field on your contact cards |
| Google Contacts | Google's own generated birthday calendar |

Prism looks through every kind of calendar: Google, iCloud/CalDAV, iCal
subscriptions and calendars you made inside Prism.

!!! tip "iPhone birthdays"
    iCloud contacts use CardDAV (the standard for syncing contacts), so the
    birthdays saved on contacts on your phone come straight through. Tick
    **contact birthdays** when you connect iCloud under *Settings → Integrations*.

### Adding one Prism can't find

Put the birthday on a calendar and Prism picks it up on the next sync. Your own
local Prism calendar works for this, so you don't need an outside account.

1. Create an **all-day** event on the birthday. Prism reads a timed event as
   something happening *near* a birthday, and skips it.
2. Give it a title with the person's name and the word **birthday**:
   `Grandma's Birthday`
3. If you want their age shown, add the birth year in brackets:
   `Grandma's Birthday (1948)`

Without a year you still get the date and the countdown, but no age.

## Use it

### Anniversaries and milestones

**Anniversaries** work the same way: put **anniversary** in the title.

**Milestones** have no keyword to look for, so Prism goes by the event's shape: an
all-day event that **repeats every year** and has a **year** in the title.

```
Ana and Ben (2005)     ✅ milestone
Moved into the house     ❌ no year, so it's just an event
```

If you keep a calendar that holds nothing but life events, open
**Manage calendars** and turn on **"Treat every all-day event here as a birthday
or milestone"**. Titles on that calendar then need no keyword at all.

### Other languages

Prism matches titles in English and German, so `Geburtstag`, `Hochzeitstag` and
`Jubiläum` all work. Adding another language takes one line in
`src/lib/services/birthday-detect.ts`, and contributions are welcome.

### Removing one

A birthday you delete in Prism stays deleted. It won't come back on the next
sync, even though the calendar event is still there, so you can tidy the list
without touching the calendar itself. Delete the calendar event as well if you
want it gone everywhere.

## Details

### What Prism deliberately ignores

- **Read-only calendars you subscribe to**, such as school terms and public
  holidays. This is what keeps "No School: Martin Luther King's Birthday" from
  turning into a family birthday.
- **Events happening near a birthday**, such as "birthday party", "prep for
  Sam's birthday" or "birthday dinner". These are about the celebration, and the
  birthday itself is a different day.

If a birthday you expect is missing, check that the event is all-day and that
its calendar isn't a read-only subscription.
