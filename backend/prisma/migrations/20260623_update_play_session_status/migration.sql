-- Add WAITING and COMPLETED to PlaySessionStatus enum
-- Rename FINISHED to COMPLETED per new business logic:
-- WAITING   = opened but not yet started playing
-- PLAYING   = timer is running
-- COMPLETED = paid / finished
-- CANCELLED = cancelled session

ALTER TYPE "PlaySessionStatus" ADD VALUE IF NOT EXISTS 'WAITING';
ALTER TYPE "PlaySessionStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- Update existing FINISHED sessions to COMPLETED
UPDATE "play_sessions" SET "status" = 'COMPLETED' WHERE "status" = 'FINISHED';
