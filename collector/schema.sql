-- Prism telemetry collector — D1 schema.
-- One row per install, de-duplicated by the random install id. No IP column
-- exists by design: the collector must not store client addresses.

CREATE TABLE IF NOT EXISTS checkins (
  id         TEXT PRIMARY KEY,   -- random UUID the install generated for itself
  version    TEXT,               -- e.g. "1.14.2"
  deployment TEXT,               -- "docker" | "ha"
  arch       TEXT,               -- e.g. "x64" | "arm64"
  first_seen TEXT NOT NULL,      -- ISO8601, first check-in
  last_seen  TEXT NOT NULL       -- ISO8601, most recent check-in
);

CREATE INDEX IF NOT EXISTS idx_checkins_last_seen ON checkins(last_seen);

-- Feedback votes (#1311): one answer per install per question. A second vote
-- from the same install replaces the first. No IP column here either.
CREATE TABLE IF NOT EXISTS votes (
  id         TEXT NOT NULL,      -- the same random install UUID as checkins.id
  referendum TEXT NOT NULL,      -- question id, e.g. "2026-11-navigation"
  answer     TEXT NOT NULL,      -- answer id, e.g. "bottom-bar"
  updated_at TEXT NOT NULL,      -- ISO8601, when this answer was last set
  PRIMARY KEY (id, referendum)
);
