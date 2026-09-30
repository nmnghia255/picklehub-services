/*
  Warnings:

  - The values [PENDING,ARCHIVED] on the enum `SportCenterStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SportCenterStatus_new" AS ENUM ('ACTIVE', 'INACTIVE');
ALTER TABLE "public"."sport_centers" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "sport_centers" ALTER COLUMN "status" TYPE "SportCenterStatus_new" USING ("status"::text::"SportCenterStatus_new");
ALTER TYPE "SportCenterStatus" RENAME TO "SportCenterStatus_old";
ALTER TYPE "SportCenterStatus_new" RENAME TO "SportCenterStatus";
DROP TYPE "public"."SportCenterStatus_old";
ALTER TABLE "sport_centers" ALTER COLUMN "status" SET DEFAULT 'INACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "sport_centers" ADD COLUMN     "deleted_at" TIMESTAMP(6),
ALTER COLUMN "status" SET DEFAULT 'INACTIVE';
