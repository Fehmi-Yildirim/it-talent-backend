-- CreateTable
CREATE TABLE "content_pages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_translations" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "locale" VARCHAR(2) NOT NULL,
    "draftTitle" TEXT,
    "draftIntroduction" TEXT,
    "draftContent" JSONB,
    "publishedTitle" TEXT,
    "publishedIntroduction" TEXT,
    "publishedContent" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_pages_slug_key" ON "content_pages"("slug");

-- CreateIndex
CREATE INDEX "content_translations_locale_isPublished_idx" ON "content_translations"("locale", "isPublished");

-- CreateIndex
CREATE INDEX "content_translations_updatedById_idx" ON "content_translations"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "content_translations_pageId_locale_key" ON "content_translations"("pageId", "locale");

-- AddForeignKey
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "content_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_translations" ADD CONSTRAINT "content_translations_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
