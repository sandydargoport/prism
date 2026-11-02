-- 0040_caldav_in_event_form.sql
--
-- CalDAV calendars are offered in the event form now that an event made in
-- Prism is created on the server (#687). Each was connected with "Show in
-- Add Event" off, and Settings did not let it be switched on, so every off
-- value here is the old connect default rather than a choice. Turn them on.
-- Calendars named like subscriptions (Birthdays, Holidays) stay out of the
-- form by name whatever this flag says.

UPDATE calendar_sources
SET show_in_event_modal = true
WHERE provider = 'caldav' AND show_in_event_modal = false;
