-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "centerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "uuid" UUID NOT NULL DEFAULT gen_random_uuid();

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_uuid_key" ON "Tournament"("uuid");

