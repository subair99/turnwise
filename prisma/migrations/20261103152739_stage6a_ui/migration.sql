-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "clockStartedAt" TIMESTAMP(3),
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'live',
ADD COLUMN     "secondsPerDay" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Cycle" ADD COLUMN     "auctionOpenedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "city" TEXT;
