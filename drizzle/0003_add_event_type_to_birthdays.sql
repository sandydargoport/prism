-- Add eventType and googleCalendarSource columns to birthdays table
-- eventType distinguishes birthdays, anniversaries, and milestones
-- googleCalendarSource tracks which Google Calendar the event was synced from

ALTER TABLE "birthdays" ADD COLUMN "event_type" varchar(20) NOT NULL DEFAULT 'birthday';
ALTER TABLE "birthdays" ADD COLUMN "google_calendar_source" varchar(50);
