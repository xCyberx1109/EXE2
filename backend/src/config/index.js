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
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5174',
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@store.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    adminName: process.env.SEED_ADMIN_NAME || 'Quản trị viên',
  },
  autoSeedOnStart: process.env.AUTO_SEED_ON_START === 'true',
};

export default config;
