ALTER TABLE "users"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

UPDATE "users"
SET
  "firstName" = 'Unknown',
  "lastName" = 'User'
WHERE "firstName" IS NULL
   OR "lastName" IS NULL;

ALTER TABLE "users"
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;