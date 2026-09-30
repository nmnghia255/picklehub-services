-- AlterTable
ALTER TABLE "products" ADD COLUMN     "deleted_at" TIMESTAMP(6);

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "deleted_at" TIMESTAMP(6);
