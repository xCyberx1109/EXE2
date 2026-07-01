/**
 * Helper dùng chung cho theo dõi tồn kho theo lô + hạn sử dụng (FEFO — First Expired First Out).
 * Dùng chung giữa inventory.service.js, order.service.js, billiard.service.js để tránh lặp logic.
 *
 * QUAN TRỌNG: các hàm ở đây KHÔNG đụng vào `Ingredient.quantity` — con số đó vẫn là nguồn số liệu
 * chính, được cập nhật y hệt như trước (không đổi). Batch chỉ là lớp chi tiết bổ sung bên dưới,
 * nên nếu batch thiếu/lệch (vd nguyên liệu cũ chưa kịp backfill), hệ thống vẫn không bị chặn —
 * chỉ tiêu thụ tối đa những gì có trong batch, không throw lỗi.
 */

function buildBatchCode(prefix = 'LOT') {
  return `${prefix}-${Date.now()}`;
}

/**
 * Trừ dần từ các lô ACTIVE theo thứ tự hạn sử dụng gần nhất trước (NULL = không rõ hạn, trừ sau
 * cùng), rồi tới ngày nhận hàng sớm nhất. Phải gọi trong cùng 1 Prisma interactive transaction (tx)
 * với thao tác trừ Ingredient.quantity để đảm bảo nhất quán.
 */
export async function consumeIngredientBatchesFEFO(tx, ingredientId, quantityToConsume) {
  let remaining = Number(quantityToConsume);
  if (!(remaining > 0)) return [];

  // Postgres mặc định ORDER BY ... ASC đặt NULL ở cuối, đúng ý muốn (lô không rõ hạn dùng sau cùng).
  const batches = await tx.ingredientBatch.findMany({
    where: { ingredientId, status: 'ACTIVE', quantity: { gt: 0 } },
    orderBy: [{ expiryDate: 'asc' }, { receivedDate: 'asc' }],
  });

  const consumed = [];
  for (const batch of batches) {
    if (remaining <= 0) break;
    const available = Number(batch.quantity);
    const take = Math.min(available, remaining);
    const newQty = available - take;

    await tx.ingredientBatch.update({
      where: { id: batch.id },
      data: {
        quantity: newQty,
        status: newQty <= 0 ? 'DEPLETED' : 'ACTIVE',
      },
    });

    consumed.push({ batchId: batch.id, batchCode: batch.batchCode, quantity: take, expiryDate: batch.expiryDate });
    remaining -= take;
  }

  return consumed;
}

/** Tạo 1 lô mới khi nhập kho / điều chỉnh tăng. */
export async function createIngredientBatch(tx, { accountId, ingredientId, quantity, unitCost, expiryDate, batchCode, createdBy, note }) {
  return tx.ingredientBatch.create({
    data: {
      accountId,
      ingredientId,
      batchCode: batchCode && batchCode.trim() ? batchCode.trim() : buildBatchCode(),
      quantity,
      initialQuantity: quantity,
      unitCost: unitCost ?? null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      createdBy,
      note: note || null,
    },
  });
}
