/**
 * In-memory rate limiter with automatic stale key eviction.
 */
class RateLimiter {
  constructor({ windowMs = 60_000, maxRequests = 30, cleanupIntervalMs = 60_000 } = {}) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.hits = new Map();

    if (cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);
      if (this.cleanupTimer.unref) {
        this.cleanupTimer.unref(); // Do not block Node event loop on exit
      }
    }
  }

  middleware() {
    return (req, res, next) => {
      // Use Express req.ip (proxy-aware when trust proxy is explicitly configured), falling back to socket address
      const ip = req.ip || req.socket?.remoteAddress || "127.0.0.1";
      const now = Date.now();

      let entry = this.hits.get(ip);
      if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + this.windowMs };
        this.hits.set(ip, entry);
      }

      entry.count += 1;

      if (entry.count > this.maxRequests) {
        res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
        return res.status(429).json({ error: "Demasiadas peticiones" });
      }

      next();
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.hits.entries()) {
      if (now > entry.resetAt) {
        this.hits.delete(key);
      }
    }
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.hits.clear();
  }
}

module.exports = {
  RateLimiter,
};
