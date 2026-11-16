-- 0040_caldav_in_event_form.sql
--
-- CalDAV calendars are offered in the event form now that an event made in
-- Prism is created on the server (#687). Each was connected with "Show in
-- Add Event" off, and Settings did not let it be switched on, so every off
-- value here is the old connect default rather than a choice. Turn them on.
-- Calendars named like subscriptions (Birthdays, Holidays) stay out of the
-- form by name whatever this flag says.
--
-- Runs its update once (#1228): the column's comment is set in the same
-- block and checked first, so a replay does not turn back on a calendar a
-- parent has since switched off.

DO $$
BEGIN
  IF col_description(
       (quote_ident(current_schema()) || '.calendar_sources')::regclass,
       (SELECT ordinal_position FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'calendar_sources'
          AND column_name = 'show_in_event_modal')::int
     ) IS DISTINCT FROM '0040 applied' THEN
    UPDATE calendar_sources
    SET show_in_event_modal = true
    WHERE provider = 'caldav' AND show_in_event_modal = false;
    COMMENT ON COLUMN calendar_sources.show_in_event_modal IS '0040 applied';
  END IF;
END $$;
