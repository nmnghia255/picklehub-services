-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "paymentAccountName" TEXT,
ADD COLUMN     "paymentAccountNumber" TEXT,
ADD COLUMN     "paymentBankName" TEXT,
ADD COLUMN     "paymentNote" TEXT,
ADD COLUMN     "paymentQrUrl" TEXT;
