-- 0013_icloud_shared_album_url.sql
--
-- iCloud Shared Album photo source (#57 Phase B). The user creates a public
-- shared album in Apple Photos, pastes the share URL into Prism Settings.
-- The shared-streams web service (Apple's non-public-but-stable public-
-- preview channel) returns photo metadata + signed download URLs. See
-- lib/integrations/icloud-shared.ts for the protocol.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS is a no-op on a re-run.

ALTER TABLE photo_sources
  ADD COLUMN IF NOT EXISTS icloud_share_url text;
