const locks = new Map();

const DEFAULT_TTL_MS = 30_000;

export const lockService = {
  acquire(key, ttlMs = DEFAULT_TTL_MS) {
    const now = Date.now();
    const existing = locks.get(key);

    if (existing && existing.expiresAt > now) {
      return false;
    }

    locks.set(key, {
      acquiredAt: now,
      expiresAt: now + ttlMs,
    });

    return true;
  },

  release(key) {
    locks.delete(key);
  },

  isLocked(key) {
    const existing = locks.get(key);
    if (!existing) return false;
    if (existing.expiresAt <= Date.now()) {
      locks.delete(key);
      return false;
    }
    return true;
  },

  cleanup() {
    const now = Date.now();
    for (const [key, lock] of locks) {
      if (lock.expiresAt <= now) {
        locks.delete(key);
      }
    }
  },
};

setInterval(() => lockService.cleanup(), 60_000);
