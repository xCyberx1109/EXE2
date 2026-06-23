-- Add RESTAURANT value to PosMachineTemplate enum
-- This migration synchronizes the PostgreSQL enum with the Prisma schema definition.
ALTER TYPE "PosMachineTemplate" ADD VALUE IF NOT EXISTS 'RESTAURANT';
