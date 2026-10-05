-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "cvConsentAt" TIMESTAMP(3),
ADD COLUMN     "cvExpiresAt" TIMESTAMP(3),
ADD COLUMN     "cvMimeType" TEXT,
ADD COLUMN     "cvOriginalName" TEXT,
ADD COLUMN     "cvPath" TEXT,
ADD COLUMN     "cvRetentionConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cvSize" INTEGER;
