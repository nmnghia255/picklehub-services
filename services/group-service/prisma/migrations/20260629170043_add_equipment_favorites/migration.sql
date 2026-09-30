-- CreateEnum
CREATE TYPE "FavoriteQuantityType" AS ENUM ('ALL', 'NUMBER');

-- AlterTable
ALTER TABLE "group_equipment" ADD COLUMN     "is_favorite" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "group_equipment_favorites" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "default_quantity" INTEGER NOT NULL DEFAULT 1,
    "default_quantity_type" "FavoriteQuantityType" NOT NULL DEFAULT 'NUMBER',
    "default_condition" "EquipmentCondition" NOT NULL DEFAULT 'NEW',
    "default_cost" INTEGER NOT NULL DEFAULT 0,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "group_equipment_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_equipment_favorites_group_id_idx" ON "group_equipment_favorites"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_equipment_favorites_group_id_name_key" ON "group_equipment_favorites"("group_id", "name");

-- AddForeignKey
ALTER TABLE "group_equipment_favorites" ADD CONSTRAINT "group_equipment_favorites_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
