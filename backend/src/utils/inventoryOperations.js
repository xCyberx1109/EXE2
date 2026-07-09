import { Prisma } from '@prisma/client';
import prisma from '../prisma/client.js';
import { AppError } from './AppError.js';
import { consumeIngredientBatchesFEFO } from './inventoryBatches.js';

async function resolveRecipeFromSnapshot(tx, snapshot) {
  const ingredientIds = snapshot.map((s) => s.ingredientId);
  const ingredients = await tx.ingredient.findMany({ where: { id: { in: ingredientIds } } });
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  return snapshot
    .map((s) => ({ ingredientId: s.ingredientId, amount: s.amount, ingredient: byId.get(s.ingredientId) }))
    .filter((r) => r.ingredient);
}

export async function validateInventoryForOrder(order, tx) {
  const orderItems = order.items || [];
  const issues = [];

  const inventoryIds = orderItems
    .filter(i => i.inventoryId && !i.menuItemId)
    .map(i => i.inventoryId);
  const ingredients = inventoryIds.length > 0
    ? await (tx || prisma).ingredient.findMany({ where: { id: { in: inventoryIds } } })
    : [];
  const ingredientMap = new Map(ingredients.map(i => [i.id, i]));

  for (const orderItem of orderItems) {
    if (orderItem.inventoryId && !orderItem.menuItemId) {
      const ingredient = ingredientMap.get(orderItem.inventoryId);
      if (!ingredient) {
        issues.push({
          menuItemId: null,
          menuItemName: orderItem.name,
          missingIngredients: [{ ingredientName: orderItem.name, required: orderItem.quantity, available: 0 }],
        });
        continue;
      }
      const available = Number(ingredient.quantity);
      if (available < orderItem.quantity) {
        issues.push({
          menuItemId: null,
          menuItemName: orderItem.name,
          missingIngredients: [{
            ingredientName: ingredient.name,
            required: orderItem.quantity,
            available,
          }],
        });
      }
      continue;
    }

    if (!orderItem.menuItemId) {
      continue;
    }

    const recipes = orderItem.recipeSnapshot?.length > 0
      ? await resolveRecipeFromSnapshot(tx || prisma, orderItem.recipeSnapshot)
      : await (tx || prisma).menuItemIngredient.findMany({
          where: { menuItemId: orderItem.menuItemId },
          include: { ingredient: true },
        });

    const missingIngredients = [];

    for (const recipe of recipes) {
      const totalUsage = Number(recipe.amount) * orderItem.quantity;
      const ingredient = recipe.ingredient;
      const available = Number(ingredient.quantity);

      if (available < totalUsage) {
        missingIngredients.push({
          ingredientName: ingredient.name,
          required: totalUsage,
          available: available,
        });
      }
    }

    if (missingIngredients.length > 0) {
      issues.push({
        menuItemId: orderItem.menuItemId,
        menuItemName: orderItem.name,
        missingIngredients,
      });
    }
  }

  return issues;
}

export async function deductInventoryForOrderTx(tx, order, createdBy, employeeId = null) {
  const orderItems = order.items || [];
  const txRecords = [];

  for (const orderItem of orderItems) {
    if (orderItem.inventoryId && !orderItem.menuItemId) {
      const currentIngredient = await tx.ingredient.findUnique({
        where: { id: orderItem.inventoryId },
      });
      if (!currentIngredient) continue;

      const currentQty = Number(currentIngredient.quantity);
      if (currentQty < orderItem.quantity) {
        throw new AppError(
          `Không đủ hàng tồn kho: ${currentIngredient.name}. Cần ${orderItem.quantity}, có ${currentQty}`,
          400
        );
      }

      const updatedIngredient = await tx.ingredient.update({
        where: { id: orderItem.inventoryId },
        data: {
          quantity: { increment: -orderItem.quantity },
          lastUpdated: new Date(),
        },
      });

      txRecords.push({
        ingredientId: orderItem.inventoryId,
        accountId: order.accountId,
        type: 'SALE',
        quantity: orderItem.quantity,
        beforeQuantity: Number(updatedIngredient.quantity) + orderItem.quantity,
        afterQuantity: Number(updatedIngredient.quantity),
        note: `Direct sale from order ${order.orderNumber}`,
        referenceType: 'ORDER',
        referenceId: order.id,
        createdBy,
        employeeId,
      });
      await consumeIngredientBatchesFEFO(tx, orderItem.inventoryId, orderItem.quantity);
      continue;
    }

    if (!orderItem.menuItemId) {
      continue;
    }

    const recipes = orderItem.recipeSnapshot?.length > 0
      ? await resolveRecipeFromSnapshot(tx, orderItem.recipeSnapshot)
      : await tx.menuItemIngredient.findMany({
          where: { menuItemId: orderItem.menuItemId },
          include: { ingredient: true },
        });

    for (const recipe of recipes) {
      const totalUsage = Number(recipe.amount) * orderItem.quantity;
      const ingredient = recipe.ingredient;

      if (!ingredient) {
        continue;
      }

      const currentQty = Number(ingredient.quantity);

      if (currentQty < totalUsage) {
        throw new AppError(
          `Không đủ nguyên liệu: ${ingredient.name}. Cần ${totalUsage}, có ${currentQty}`,
          400
        );
      }

      const updatedIngredient = await tx.ingredient.update({
        where: { id: recipe.ingredientId },
        data: {
          quantity: { increment: -totalUsage },
          lastUpdated: new Date(),
        },
      });

      txRecords.push({
        ingredientId: recipe.ingredientId,
        accountId: order.accountId,
        type: 'OUT',
        quantity: totalUsage,
        beforeQuantity: Number(updatedIngredient.quantity) + totalUsage,
        afterQuantity: Number(updatedIngredient.quantity),
        note: `Deduction from order ${order.orderNumber}`,
        referenceType: 'ORDER',
        referenceId: order.id,
        createdBy,
        employeeId,
      });
      await consumeIngredientBatchesFEFO(tx, recipe.ingredientId, totalUsage);
    }
  }

  if (txRecords.length > 0) {
    console.log('[INVENTORY DEDUCT]', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      createdBy,
      employeeId,
      txCount: txRecords.length,
    });
    await tx.inventoryTransaction.createMany({ data: txRecords });
  }
}

export async function computeRequiredIngredients(tx, orderItems) {
  const required = new Map();

  for (const item of orderItems) {
    if (item.inventoryId && !item.menuItemId) {
      required.set(item.inventoryId, (required.get(item.inventoryId) || 0) + Number(item.quantity));
      continue;
    }
    if (!item.menuItemId) continue;

    const recipes = await tx.menuItemIngredient.findMany({ where: { menuItemId: item.menuItemId } });
    for (const recipe of recipes) {
      const usage = Number(recipe.amount) * Number(item.quantity);
      required.set(recipe.ingredientId, (required.get(recipe.ingredientId) || 0) + usage);
    }
  }

  return required;
}

export async function releaseReservationsForOrder(tx, orderId) {
  await tx.inventoryReservation.deleteMany({ where: { orderId } });
}

export async function reserveInventoryForOrderTx(tx, order) {
  const orderItems = order.items || [];
  const required = await computeRequiredIngredients(tx, orderItems);

  if (required.size === 0) {
    await tx.inventoryReservation.deleteMany({ where: { orderId: order.id } });
    return;
  }

  const ingredientIds = Array.from(required.keys());
  const locked = await tx.$queryRaw`
    SELECT "id", "name", "quantity" FROM "ingredients"
    WHERE "id" IN (${Prisma.join(ingredientIds)}) FOR UPDATE
  `;
  const ingredientMap = {};
  for (const row of locked) {
    ingredientMap[row.id] = { name: row.name, quantity: Number(row.quantity) };
  }

  const reservationSums = await tx.inventoryReservation.groupBy({
    by: ['ingredientId'],
    _sum: { quantity: true },
    where: { ingredientId: { in: ingredientIds }, orderId: { not: order.id } },
  });
  const reservedMap = {};
  for (const r of reservationSums) {
    reservedMap[r.ingredientId] = Number(r._sum.quantity || 0);
  }

  for (const [ingredientId, amount] of required.entries()) {
    const ingredient = ingredientMap[ingredientId];
    if (!ingredient) continue;

    const reserved = reservedMap[ingredientId] || 0;
    const available = ingredient.quantity - reserved;

    if (available < amount) {
      throw new AppError(
        `Không đủ tồn kho khả dụng cho "${ingredient.name}" (có thể đã được đơn khác giữ chỗ). Cần ${amount}, còn khả dụng ${available}.`,
        400
      );
    }
  }

  await tx.inventoryReservation.deleteMany({ where: { orderId: order.id } });
  await tx.inventoryReservation.createMany({
    data: Array.from(required.entries()).map(([ingredientId, amount]) => ({
      accountId: order.accountId,
      orderId: order.id,
      ingredientId,
      quantity: amount,
    })),
  });
}
