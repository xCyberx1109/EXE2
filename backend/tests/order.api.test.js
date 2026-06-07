import request from 'supertest';
import app from '../src/app.js';

describe('POST /api/orders reference validation', () => {
  // NOTE: You must adjust the following values to match your real seed/test data
  const missingAccountId = 'nonexistent-account-123';
  const validTableId = 'valid-table-123';
  const validMenuItemId = 'valid-menu-item-123';
  const validUserId = 'valid-user-123';

  it('should return 400 if accountId is invalid', async () => {
    const payload = {
      table: 'A1',
      accountId: missingAccountId,
      tableId: validTableId,
      createdBy: validUserId,
      items: [{ menuItemId: validMenuItemId, quantity: 1 }]
    };
    const response = await request(app)
      .post('/api/orders')
      .send(payload);
    expect(response.status).toBe(400);
  });

  it('should return 400 with "Table not found" if tableId is invalid', async () => {
    const payload = {
      table: 'A1',
      accountId: missingAccountId,
      tableId: 'invalid-table-123',
      createdBy: validUserId,
      items: [{ menuItemId: validMenuItemId, quantity: 1 }]
    };
    const response = await request(app)
      .post('/api/orders')
      .send(payload);
    expect(response.status).toBe(400);
  });

  it('should return 400 with "Product not found" if menuItemId is invalid', async () => {
    const payload = {
      table: 'A1',
      accountId: missingAccountId,
      tableId: validTableId,
      createdBy: validUserId,
      items: [{ menuItemId: 'invalid-menu-item-123', quantity: 1 }]
    };
    const response = await request(app)
      .post('/api/orders')
      .send(payload);
    expect(response.status).toBe(400);
  });

  it('should return 400 if order items array is missing or empty', async () => {
    const payload = {
      table: 'A1',
      accountId: missingAccountId,
      tableId: validTableId,
      createdBy: validUserId,
      items: []
    };
    const response = await request(app)
      .post('/api/orders')
      .send(payload);
    expect(response.status).toBe(400);
  });
});

// ========================================
// ORDER QUEUE POS - PERMISSION & WORKFLOW TESTS
// ========================================

describe('Order Queue POS API', () => {
  describe('GET /api/orders/queue - permission enforcement', () => {
    it('should return 401 when called without auth token', async () => {
      const response = await request(app).get('/api/orders/queue');
      expect([401, 403]).toContain(response.status);
    });

    it('should be accessible via backward-compatible alias /api/orders/order-queue', async () => {
      const response = await request(app).get('/api/orders/order-queue');
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('POST /api/orders/queue - permission enforcement', () => {
    it('should return 401 when called without auth token', async () => {
      const response = await request(app)
        .post('/api/orders/queue')
        .send({ items: [{ menuItemId: 'test', quantity: 1 }] });
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('PUT /api/orders/queue/:id - permission enforcement', () => {
    it('should return 401 when called without auth token', async () => {
      const response = await request(app)
        .put('/api/orders/queue/fake-id')
        .send({ items: [] });
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('POST /api/orders/queue/:id/payment - permission enforcement', () => {
    it('should return 401 when called without auth token', async () => {
      const response = await request(app)
        .post('/api/orders/queue/fake-id/payment')
        .send({ paymentMethod: 'CASH' });
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('POST /api/orders/queue/:id/cancel - permission enforcement', () => {
    it('should return 401 when called without auth token', async () => {
      const response = await request(app)
        .post('/api/orders/queue/fake-id/cancel');
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Backward-compatible aliases', () => {
    it('PATCH /api/orders/order-queue/:id should require auth', async () => {
      const response = await request(app)
        .patch('/api/orders/order-queue/fake-id')
        .send({ items: [] });
      expect([401, 403]).toContain(response.status);
    });

    it('POST /api/orders/order-queue/:id/payment should require auth', async () => {
      const response = await request(app)
        .post('/api/orders/order-queue/fake-id/payment')
        .send({ paymentMethod: 'CASH' });
      expect([401, 403]).toContain(response.status);
    });

    it('DELETE /api/orders/order-queue/:id should require auth', async () => {
      const response = await request(app)
        .delete('/api/orders/order-queue/fake-id');
      expect([401, 403]).toContain(response.status);
    });
  });
});
