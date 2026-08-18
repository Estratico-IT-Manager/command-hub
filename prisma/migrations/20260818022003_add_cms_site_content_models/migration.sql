-- CreateEnum
CREATE TYPE "ContentFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'MARKDOWN', 'IMAGE', 'NUMBER', 'BOOLEAN', 'SELECT', 'MULTISELECT', 'DATE', 'DATETIME', 'RELATION', 'REPEATER');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "project" ALTER COLUMN "description" DROP NOT NULL;

-- CreateTable
CREATE TABLE "site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "apiKeyHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_type" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_type_field" (
    "id" TEXT NOT NULL,
    "contentTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ContentFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "relationTypeId" TEXT,
    "isTitle" BOOLEAN NOT NULL DEFAULT false,
    "isSlugSource" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_type_field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_entry" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "contentTypeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_slug_key" ON "site"("slug");

-- CreateIndex
CREATE INDEX "site_isActive_idx" ON "site"("isActive");

-- CreateIndex
CREATE INDEX "content_type_siteId_idx" ON "content_type"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "content_type_siteId_name_key" ON "content_type"("siteId", "name");

-- CreateIndex
CREATE INDEX "content_type_field_contentTypeId_idx" ON "content_type_field"("contentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "content_type_field_contentTypeId_name_key" ON "content_type_field"("contentTypeId", "name");

-- CreateIndex
CREATE INDEX "content_entry_siteId_idx" ON "content_entry"("siteId");

-- CreateIndex
CREATE INDEX "content_entry_contentTypeId_status_idx" ON "content_entry"("contentTypeId", "status");

-- CreateIndex
CREATE INDEX "content_entry_contentTypeId_slug_idx" ON "content_entry"("contentTypeId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "content_entry_contentTypeId_slug_key" ON "content_entry"("contentTypeId", "slug");

-- CreateIndex
CREATE INDEX "media_asset_siteId_idx" ON "media_asset"("siteId");

-- AddForeignKey
ALTER TABLE "content_type" ADD CONSTRAINT "content_type_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_type_field" ADD CONSTRAINT "content_type_field_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "content_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entry" ADD CONSTRAINT "content_entry_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entry" ADD CONSTRAINT "content_entry_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "content_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
