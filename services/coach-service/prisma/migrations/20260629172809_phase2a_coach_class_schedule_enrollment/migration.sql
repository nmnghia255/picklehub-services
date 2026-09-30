-- CreateTable
CREATE TABLE "coach_classes" (
    "id" UUID NOT NULL,
    "coach_profile_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "level" VARCHAR(50),
    "capacity" INTEGER NOT NULL,
    "enrolled_count" INTEGER NOT NULL DEFAULT 0,
    "price_vnd" INTEGER NOT NULL,
    "location_description" VARCHAR(300),
    "cover_image_url" VARCHAR(500),
    "status" "ClassStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" TIMESTAMP(6),
    "end_date" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "coach_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_schedules" (
    "id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(6) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_enrollments" (
    "id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING_PROOF',
    "amount_vnd" INTEGER NOT NULL,
    "payment_proof_url" VARCHAR(500),
    "proof_uploaded_at" TIMESTAMP(6),
    "settled_at" TIMESTAMP(6),
    "enrolled_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(6),

    CONSTRAINT "class_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_classes_coach_profile_id_idx" ON "coach_classes"("coach_profile_id");

-- CreateIndex
CREATE INDEX "coach_classes_status_idx" ON "coach_classes"("status");

-- CreateIndex
CREATE INDEX "class_schedules_class_id_idx" ON "class_schedules"("class_id");

-- CreateIndex
CREATE INDEX "class_schedules_scheduled_at_idx" ON "class_schedules"("scheduled_at");

-- CreateIndex
CREATE INDEX "class_enrollments_learner_id_idx" ON "class_enrollments"("learner_id");

-- CreateIndex
CREATE INDEX "class_enrollments_class_id_status_idx" ON "class_enrollments"("class_id", "status");

-- CreateIndex
CREATE INDEX "class_enrollments_payment_status_idx" ON "class_enrollments"("payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "class_enrollments_class_id_learner_id_key" ON "class_enrollments"("class_id", "learner_id");

-- AddForeignKey
ALTER TABLE "coach_classes" ADD CONSTRAINT "coach_classes_coach_profile_id_fkey" FOREIGN KEY ("coach_profile_id") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "coach_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_enrollments" ADD CONSTRAINT "class_enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "coach_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
