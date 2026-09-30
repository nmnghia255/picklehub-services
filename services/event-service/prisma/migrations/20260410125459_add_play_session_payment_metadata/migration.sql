-- AlterTable
ALTER TABLE "play_sessions" ADD COLUMN     "payment_code" VARCHAR(120),
ADD COLUMN     "payment_note" VARCHAR(500),
ADD COLUMN     "payment_qr_url" VARCHAR(500);
