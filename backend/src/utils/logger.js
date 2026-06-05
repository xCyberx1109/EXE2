export function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const prefix = local.slice(0, Math.min(3, local.length));
  return `${prefix}***@${domain}`;
}

export const requestLogger = {
  log(requestId, message, ...args) {
    const prefix = requestId ? `[${requestId}]` : '[no-req]';
    console.log(`${prefix} ${message}`, ...args);
  },

  warn(requestId, message, ...args) {
    const prefix = requestId ? `[${requestId}]` : '[no-req]';
    console.warn(`${prefix} ${message}`, ...args);
  },

  error(requestId, message, ...args) {
    const prefix = requestId ? `[${requestId}]` : '[no-req]';
    console.error(`${prefix} ${message}`, ...args);
  },
};

export const mailLogger = {
  log(requestId, message, extra = {}) {
    const extraStr = Object.entries(extra)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${v}`)
      .join(' | ');
    const suffix = extraStr ? ` | ${extraStr}` : '';
    console.log(`[EMAIL][${requestId || 'no-req'}] ${message}${suffix}`);
  },

  warn(requestId, message, extra = {}) {
    const extraStr = Object.entries(extra)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${v}`)
      .join(' | ');
    const suffix = extraStr ? ` | ${extraStr}` : '';
    console.warn(`[EMAIL][${requestId || 'no-req'}] ${message}${suffix}`);
  },

  error(requestId, message, error = null, extra = {}) {
    const extraStr = Object.entries(extra)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${v}`)
      .join(' | ');
    const suffix = extraStr ? ` | ${extraStr}` : '';
    console.error(`[EMAIL][${requestId || 'no-req'}] ${message}${suffix}`);
    if (error) {
      console.error(`[EMAIL][${requestId || 'no-req'}] Error object:`, error);
    }
  },
};
