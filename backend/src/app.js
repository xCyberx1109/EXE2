import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config/index.js';
import apiRoutes from './routes/index.js';
import { legacyOrdersRouter } from './modules/orders/order.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// REST API chuẩn
app.use('/api', apiRoutes);

// Legacy POS/QR - GET/POST/DELETE /orders (raw JSON)
app.use('/orders', legacyOrdersRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
