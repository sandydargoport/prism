-- Add is_family column to calendar_sources table
-- This distinguishes between family shared calendars and unassigned calendars
ALTER TABLE "calendar_sources" ADD COLUMN IF NOT EXISTS "is_family" boolean DEFAULT false NOT NULL;
