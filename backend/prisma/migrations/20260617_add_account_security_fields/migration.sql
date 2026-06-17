-- Add security fields to accounts table
ALTER TABLE "public"."accounts" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."accounts" ADD COLUMN IF NOT EXISTS "lockUntil" TIMESTAMPTZ(6);
ALTER TABLE "public"."accounts" ADD COLUMN IF NOT EXISTS "resetPasswordToken" TEXT;
ALTER TABLE "public"."accounts" ADD COLUMN IF NOT EXISTS "resetPasswordExpires" TIMESTAMPTZ(6);
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_resetPasswordToken_key" ON "public"."accounts"("resetPasswordToken") WHERE "resetPasswordToken" IS NOT NULL;
