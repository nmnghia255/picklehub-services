-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "group_guests" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "skill_level" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(20),
    "gender" VARCHAR(20),
    "invited_by_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "group_guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_guest_payments" (
    "id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "billed_to_id" UUID NOT NULL,
    "required_fee" INTEGER NOT NULL DEFAULT 0,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paid_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "group_guest_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_guests_group_id_idx" ON "group_guests"("group_id");

-- CreateIndex
CREATE INDEX "group_guests_invited_by_id_idx" ON "group_guests"("invited_by_id");

-- CreateIndex
CREATE INDEX "group_guests_status_idx" ON "group_guests"("status");

-- CreateIndex
CREATE INDEX "group_guest_payments_expense_id_idx" ON "group_guest_payments"("expense_id");

-- CreateIndex
CREATE INDEX "group_guest_payments_guest_id_idx" ON "group_guest_payments"("guest_id");

-- CreateIndex
CREATE INDEX "group_guest_payments_billed_to_id_idx" ON "group_guest_payments"("billed_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_guest_payments_expense_id_guest_id_key" ON "group_guest_payments"("expense_id", "guest_id");

-- AddForeignKey
ALTER TABLE "group_guests" ADD CONSTRAINT "group_guests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_guests" ADD CONSTRAINT "group_guests_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_guest_payments" ADD CONSTRAINT "group_guest_payments_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "group_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_guest_payments" ADD CONSTRAINT "group_guest_payments_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "group_guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_guest_payments" ADD CONSTRAINT "group_guest_payments_billed_to_id_fkey" FOREIGN KEY ("billed_to_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
