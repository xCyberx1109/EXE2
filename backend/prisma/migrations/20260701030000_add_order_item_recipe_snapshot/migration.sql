-- Them snapshot cong thuc (recipe versioning) tren order_items — luu lai cong thuc thuc te
-- tai thoi diem tao don, de tru kho luc thanh toan dung theo cong thuc do, khong bi anh huong
-- neu cong thuc bi sua doi sau khi don da duoc tao. Nullable -> khong pha vo don cu.

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "recipeSnapshot" JSONB;
