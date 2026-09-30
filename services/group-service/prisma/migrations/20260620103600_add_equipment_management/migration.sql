-- CreateEnum
CREATE TYPE "EquipmentCondition" AS ENUM ('NEW', 'GOOD', 'WORN', 'RETIRED');

-- CreateTable
CREATE TABLE "group_equipment" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" "EquipmentCondition" NOT NULL DEFAULT 'NEW',
    "purchase_cost" INTEGER NOT NULL DEFAULT 0,
    "purchased_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expense_id" UUID,
    "created_by" UUID NOT NULL,
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "group_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_equipment_group_id_idx" ON "group_equipment"("group_id");

-- CreateIndex
CREATE INDEX "group_equipment_expense_id_idx" ON "group_equipment"("expense_id");

-- CreateIndex
CREATE INDEX "group_equipment_condition_idx" ON "group_equipment"("condition");

-- CreateIndex
CREATE INDEX "group_equipment_deleted_at_idx" ON "group_equipment"("deleted_at");

-- AddForeignKey
ALTER TABLE "group_equipment" ADD CONSTRAINT "group_equipment_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_equipment" ADD CONSTRAINT "group_equipment_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "group_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
