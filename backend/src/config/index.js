import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  posJwt: {
    secret: process.env.POS_JWT_SECRET || process.env.JWT_SECRET || 'pos-secret',
    expiresIn: process.env.POS_JWT_EXPIRES_IN || '30d',
  },
  deviceToken: {
    expiresInDays: parseInt(process.env.DEVICE_TOKEN_EXPIRY_DAYS || '30', 10),
  },
  setupPin: {
    length: parseInt(process.env.SETUP_PIN_LENGTH || '6', 10),
  },
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5174',
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@store.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    adminName: process.env.SEED_ADMIN_NAME || 'Quản trị viên',
  },
  autoSeedOnStart: process.env.AUTO_SEED_ON_START === 'true',
  allowNegativeStock: process.env.ALLOW_NEGATIVE_STOCK === 'true',
};

export default config;
