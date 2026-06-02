// Legacy POS auth middleware - re-exports the unified device auth
// Kept for backward compatibility with staffAuth, shift, and deviceAuth modules
export { requireDeviceAuth as requirePosAuth } from './auth.js';
