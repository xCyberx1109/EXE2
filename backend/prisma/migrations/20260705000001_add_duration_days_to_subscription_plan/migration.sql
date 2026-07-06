ALTER TABLE "subscription_plans" ADD COLUMN "duration_days" INTEGER NOT NULL DEFAULT 30;

UPDATE "subscription_plans" SET "duration_days" = 30 WHERE "code" = 'basic';
UPDATE "subscription_plans" SET "duration_days" = 365 WHERE "code" = 'pro';
UPDATE "subscription_plans" SET "duration_days" = 365 WHERE "code" = 'enterprise';
