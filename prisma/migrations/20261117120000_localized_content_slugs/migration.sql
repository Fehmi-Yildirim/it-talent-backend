-- Add the translation-specific slug as a nullable column first.
ALTER TABLE "content_translations"
ADD COLUMN "slug" VARCHAR(100);

-- Preserve existing URLs by copying the page slug to every translation.
UPDATE "content_translations" AS translation
SET "slug" = page."slug"
FROM "content_pages" AS page
WHERE translation."pageId" = page."id";

-- Every existing translation must now have a slug.
ALTER TABLE "content_translations"
ALTER COLUMN "slug" SET NOT NULL;

-- Slugs must be unique within a locale, not globally.
CREATE UNIQUE INDEX "content_translations_locale_slug_key"
ON "content_translations"("locale", "slug");

-- Remove the old page-level slug.
DROP INDEX "content_pages_slug_key";

ALTER TABLE "content_pages"
DROP COLUMN "slug";