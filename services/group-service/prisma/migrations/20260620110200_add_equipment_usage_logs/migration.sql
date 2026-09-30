-- CreateTable
CREATE TABLE "group_equipment_usage_logs" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "quantity_used" INTEGER NOT NULL,
    "note" TEXT,
    "used_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logged_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_equipment_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_equipment_usage_logs_group_id_idx" ON "group_equipment_usage_logs"("group_id");

-- CreateIndex
CREATE INDEX "group_equipment_usage_logs_equipment_id_idx" ON "group_equipment_usage_logs"("equipment_id");

-- CreateIndex
CREATE INDEX "group_equipment_usage_logs_used_at_idx" ON "group_equipment_usage_logs"("used_at");

-- AddForeignKey
ALTER TABLE "group_equipment_usage_logs" ADD CONSTRAINT "group_equipment_usage_logs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_equipment_usage_logs" ADD CONSTRAINT "group_equipment_usage_logs_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "group_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
