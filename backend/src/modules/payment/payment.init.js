import { registerPaymentCallback } from './payment.callbacks.js';
import { deductInventoryForOrderTx } from '../../utils/inventoryOperations.js';

function computePlayCost(hourlyRate, durationMinutes) {
  return Math.round((Number(hourlyRate) * Number(durationMinutes)) / 60);
}

registerPaymentCallback('RESTAURANT', async (tx, order, method, userId) => {
  await deductInventoryForOrderTx(tx, order, userId);
  await tx.order.update({
    where: { id: order.id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  if (order.tableId) {
    await tx.table.update({
      where: { id: order.tableId },
      data: { status: 'AVAILABLE' },
    });
    if (Array.isArray(order.mergedTableIds)) {
      await tx.table.updateMany({
        where: { id: { in: order.mergedTableIds } },
        data: { status: 'AVAILABLE', isMerged: false, mergedIntoTableId: null },
      });
    }
  }
});

registerPaymentCallback('ORDER_QUEUE_POS', async (tx, order, method, userId) => {
  await deductInventoryForOrderTx(tx, order, userId);
  await tx.inventoryReservation.deleteMany({ where: { orderId: order.id } });
});

registerPaymentCallback('BILLIARD', async (tx, order, method, userId) => {
  await deductInventoryForOrderTx(tx, order, userId);

  const session = await tx.playSession.findFirst({
    where: { tableId: order.tableId, status: 'PLAYING' },
  });

  if (session) {
    const now = new Date();
    const startedAt = session.startTime ? new Date(session.startTime).getTime() : now.getTime();
    const elapsedMinutes = Math.ceil((now.getTime() - startedAt) / 60000);
    const table = await tx.table.findUnique({ where: { id: order.tableId } });
    const hourlyRate = table ? Number(table.hourlyRate) : 0;
    const playingCost = computePlayCost(hourlyRate, elapsedMinutes);
    const foodDrinkTotal = Number(order.total) || 0;

    await tx.playSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        endTime: now,
        durationMinutes: elapsedMinutes,
        tableFee: playingCost,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETED',
        sessionStartTime: session.startTime || now,
        playingDurationMinutes: elapsedMinutes,
        hourlyRate,
        playingCost,
        foodDrinkTotal,
      },
    });
  }

  if (order.tableId) {
    await tx.table.update({
      where: { id: order.tableId },
      data: { status: 'AVAILABLE' },
    });
  }
});
