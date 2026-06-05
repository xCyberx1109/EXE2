import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config/index.js';
import apiRoutes from './routes/index.js';
import { legacyOrdersRouter } from './modules/orders/order.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import prisma from './prisma/client.js';

const app = express();

const allowedOrigins = config.corsOrigins;
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) {
      return cb(null, true);
    }
    if (config.nodeEnv !== 'production') {
      return cb(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID().slice(0, 8);
  next();
});

app.use((req, res, next) => {
  req.setTimeout(25_000, () => {
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        message: 'Máy chủ quá tải, vui lòng thử lại',
      });
    }
  });
  next();
});

app.use((req, res, next) => {
  let aborted = false;
  req.on('close', () => {
    aborted = true;
  });
  res.on('close', () => {
    if (!res.writableFinished && !aborted) {
      aborted = true;
    }
  });
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (aborted) return this;
    return originalJson(body);
  };
  next();
});

// REST API chuẩn
app.use('/api', apiRoutes);

// Legacy POS/QR - GET/POST/DELETE /orders (raw JSON)
app.use('/orders', legacyOrdersRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
