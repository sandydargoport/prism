ALTER TABLE "photos" ADD COLUMN "orientation" varchar(20);
ALTER TABLE "photos" ADD COLUMN "usage" varchar(20) DEFAULT 'both' NOT NULL;
CREATE INDEX IF NOT EXISTS "photos_usage_idx" ON "photos" ("usage");

-- Backfill orientation from existing dimensions
UPDATE "photos" SET "orientation" = CASE
  WHEN "width" > "height" THEN 'landscape'
  WHEN "height" > "width" THEN 'portrait'
  WHEN "width" = "height" THEN 'square'
  ELSE NULL
END WHERE "width" IS NOT NULL AND "height" IS NOT NULL;
