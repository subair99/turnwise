/*
  Warnings:

  - A unique constraint covering the columns `[authorizationId]` on the table `PreAuthorization` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[memberId,cycleNumber]` on the table `PreAuthorization` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT,
    "orderId" TEXT,
    "invoiceId" TEXT,
    "captureId" TEXT,
    "approveUrl" TEXT,
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_orderId_key" ON "Contribution"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_invoiceId_key" ON "Contribution"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_captureId_key" ON "Contribution"("captureId");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_memberId_cycleNumber_key" ON "Contribution"("memberId", "cycleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PreAuthorization_authorizationId_key" ON "PreAuthorization"("authorizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PreAuthorization_memberId_cycleNumber_key" ON "PreAuthorization"("memberId", "cycleNumber");

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
