-- DropForeignKey
ALTER TABLE "recruiters" DROP CONSTRAINT "recruiters_companyId_fkey";

-- AlterTable
ALTER TABLE "recruiters" ALTER COLUMN "companyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "recruiters" ADD CONSTRAINT "recruiters_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
