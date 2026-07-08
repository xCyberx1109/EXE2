-- Refactor IngredientUnit: remove G, ML, UNIT; add PACK, BOX, BOTTLE, CAN
-- Migration: G → KG, ML → LITER, UNIT → PIECE

-- Create new enum type
CREATE TYPE "IngredientUnit_new" AS ENUM ('KG', 'LITER', 'PIECE', 'PACK', 'BOX', 'BOTTLE', 'CAN');

-- Migrate existing data and change column type
ALTER TABLE "ingredients"
  ALTER COLUMN "unit" TYPE "IngredientUnit_new"
  USING (
    CASE "unit"::text
      WHEN 'G' THEN 'KG'::text
      WHEN 'ML' THEN 'LITER'::text
      WHEN 'UNIT' THEN 'PIECE'::text
      ELSE "unit"::text
    END
  )::"IngredientUnit_new";

-- Drop old enum and rename new one
DROP TYPE "IngredientUnit";
ALTER TYPE "IngredientUnit_new" RENAME TO "IngredientUnit";
