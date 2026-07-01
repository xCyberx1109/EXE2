import express from 'express';
import request from 'supertest';
import {
  stockInRules,
  stockOutRules,
  ingredientUpdateRules,
  STOCK_IN_TYPES,
  STOCK_OUT_TYPES,
} from '../src/validators/inventory.validator.js';
import { validate } from '../src/middlewares/validate.js';

function buildApp(rules) {
  const app = express();
  app.use(express.json());
  app.post('/test', rules, validate, (req, res) => res.status(200).json({ ok: true, body: req.body }));
  return app;
}

describe('stockInRules / stockOutRules', () => {
  it('STOCK_IN_TYPES va STOCK_OUT_TYPES la tap con hop le cua enum InventoryTransactionType', () => {
    const validEnumValues = ['IMPORT', 'OUT', 'ADJUST', 'RETURN', 'WASTE', 'AUDIT', 'SALE'];
    for (const t of STOCK_IN_TYPES) expect(validEnumValues).toContain(t);
    for (const t of STOCK_OUT_TYPES) expect(validEnumValues).toContain(t);
  });

  it('stockIn: quantity <= 0 bi tu choi', async () => {
    const app = buildApp(stockInRules);
    const res = await request(app).post('/test').send({ quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('stockIn: khong truyen type van hop le (backward-compatible voi FE hien tai)', async () => {
    const app = buildApp(stockInRules);
    const res = await request(app).post('/test').send({ quantity: 10, note: 'nhap hang' });
    expect(res.status).toBe(200);
  });

  it('stockIn: type khong nam trong danh sach cho phep bi tu choi', async () => {
    const app = buildApp(stockInRules);
    const res = await request(app).post('/test').send({ quantity: 10, type: 'SALE' });
    expect(res.status).toBe(400);
  });

  it('stockOut: type=WASTE nhung khong co note bi tu choi ngay o tang validator', async () => {
    const app = buildApp(stockOutRules);
    const res = await request(app).post('/test').send({ quantity: 5, type: 'WASTE' });
    expect(res.status).toBe(400);
  });

  it('stockOut: type=WASTE co note thi duoc chap nhan', async () => {
    const app = buildApp(stockOutRules);
    const res = await request(app)
      .post('/test')
      .send({ quantity: 5, type: 'WASTE', note: 'Hong do bao quan sai' });
    expect(res.status).toBe(200);
  });

  it('stockOut: type=OUT (mac dinh) khong bat buoc note', async () => {
    const app = buildApp(stockOutRules);
    const res = await request(app).post('/test').send({ quantity: 5, type: 'OUT' });
    expect(res.status).toBe(200);
  });

  it('stockOut: type viet thuong van duoc chuan hoa va chap nhan', async () => {
    const app = buildApp(stockOutRules);
    const res = await request(app)
      .post('/test')
      .send({ quantity: 5, type: 'waste', note: 'ly do' });
    expect(res.status).toBe(200);
  });
});

describe('ingredientUpdateRules', () => {
  it('van cho phep PUT khong kem note (khong pha vo form edit hien tai chua co o nhap ly do)', async () => {
    const app = buildApp(ingredientUpdateRules);
    const res = await request(app).post('/test').send({ name: 'Ten moi', quantity: 10 });
    expect(res.status).toBe(200);
  });

  it('van cho phep PUT chi sua 1 field (vd price) khong can gui du field khac', async () => {
    const app = buildApp(ingredientUpdateRules);
    const res = await request(app).post('/test').send({ price: 50000 });
    expect(res.status).toBe(200);
  });
});
