-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'PRIVATE',
  'ARCHIVED'
);

-- Add new columns before removing legacy columns.
ALTER TABLE "content_translations"
ADD COLUMN "content" JSONB,
ADD COLUMN "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "title" TEXT;

-- Preserve the currently published version.
-- Unpublished translations retain their draft version.
UPDATE "content_translations"
SET
  "title" = CASE
    WHEN "isPublished" = TRUE
      THEN COALESCE("publishedTitle", "draftTitle")
    ELSE "draftTitle"
  END,
  "content" = CASE
    WHEN "isPublished" = TRUE
      THEN COALESCE("publishedContent", "draftContent")
    ELSE "draftContent"
  END,
  "status" = CASE
    WHEN "isPublished" = TRUE
      THEN 'PUBLISHED'::"ContentStatus"
    ELSE 'DRAFT'::"ContentStatus"
  END;

-- Remove the legacy index and columns.
DROP INDEX "content_translations_locale_isPublished_idx";

ALTER TABLE "content_translations"
DROP COLUMN "draftContent",
DROP COLUMN "draftTitle",
DROP COLUMN "isPublished",
DROP COLUMN "publishedContent",
DROP COLUMN "publishedTitle";

-- Index translations by locale and status.
CREATE INDEX "content_translations_locale_status_idx"
ON "content_translations"("locale", "status");