-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "branch_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_bank_accounts" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_invitations_tokenHash_key" ON "branch_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "branch_invitations_email_idx" ON "branch_invitations"("email");

-- CreateIndex
CREATE INDEX "branch_invitations_status_idx" ON "branch_invitations"("status");

-- CreateIndex
CREATE INDEX "branch_invitations_email_status_idx" ON "branch_invitations"("email", "status");

-- CreateIndex
CREATE INDEX "branch_bank_accounts_branchId_idx" ON "branch_bank_accounts"("branchId");

-- AddForeignKey
ALTER TABLE "branch_invitations" ADD CONSTRAINT "branch_invitations_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
