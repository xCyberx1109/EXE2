-- CreateEnum
CREATE TYPE "TableType" AS ENUM ('POOL', 'SNOOKER', 'VIP');

-- CreateEnum
CREATE TYPE "PlaySessionStatus" AS ENUM ('PLAYING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CHECKED_IN', 'COMPLETED', 'CANCELLED');

-- AlterTable: Add tableType, posX, posY to tables
ALTER TABLE "tables" ADD COLUMN "tableType" "TableType" NOT NULL DEFAULT 'POOL';
ALTER TABLE "tables" ADD COLUMN "posX" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "tables" ADD COLUMN "posY" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: Add sessionId to orders (nullable, unique, backward compatible)
ALTER TABLE "orders" ADD COLUMN "session_id" TEXT;
ALTER TABLE "orders" ADD UNIQUE ("session_id");

-- CreateTable: play_sessions
CREATE TABLE "play_sessions" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "expectedEndTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL,
    "tableFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "PlaySessionStatus" NOT NULL DEFAULT 'PLAYING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "play_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: reservations
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "reservationTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "note" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "play_sessions_tableId_idx" ON "play_sessions"("tableId");
CREATE INDEX "play_sessions_status_idx" ON "play_sessions"("status");
CREATE INDEX "play_sessions_tableId_status_idx" ON "play_sessions"("tableId", "status");
CREATE INDEX "reservations_tableId_idx" ON "reservations"("tableId");
CREATE INDEX "reservations_status_idx" ON "reservations"("status");
CREATE INDEX "reservations_reservationTime_idx" ON "reservations"("reservationTime");
CREATE INDEX "reservations_branchId_status_idx" ON "reservations"("branchId", "status");

-- AddForeignKeys
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "play_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
