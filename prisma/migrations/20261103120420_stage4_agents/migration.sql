-- AlterTable
ALTER TABLE "Bid" ADD COLUMN     "explanation" TEXT;

-- AlterTable
ALTER TABLE "Circle" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN     "ladderStep" TEXT NOT NULL DEFAULT 'current';

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "simulateMissCycle" INTEGER;

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "memberId" TEXT,
    "cycleNumber" INTEGER,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
