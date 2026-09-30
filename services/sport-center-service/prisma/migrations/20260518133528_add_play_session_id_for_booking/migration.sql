-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "play_session_id" UUID;

-- CreateIndex
CREATE INDEX "bookings_play_session_id_idx" ON "bookings"("play_session_id");
