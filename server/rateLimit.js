// Simple in-memory rate limiter (best-effort for serverless).
// In serverless this is per-instance; still helps blunt bursts.
const buckets = new Map();

function getClientIp(req) {
  const xf = req.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  const xr = req.headers?.['x-real-ip'];
  if (typeof xr === 'string' && xr.trim()) return xr.trim();
  return (req.socket && req.socket.remoteAddress) ? String(req.socket.remoteAddress) : 'unknown';
}

export function rateLimit(req, res, { key = 'global', limit = 30, windowMs = 60_000 } = {}) {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucketKey = `${key}:${ip}`;

  let b = buckets.get(bucketKey);
  if (!b || (now - b.resetAt) > windowMs) b = { count: 0, resetAt: now };

  b.count += 1;
  buckets.set(bucketKey, b);

  const remaining = Math.max(0, limit - b.count);
  try {
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor((b.resetAt + windowMs) / 1000)));
  } catch {}

  if (b.count > limit) {
    res.status(429).json({ error: 'Muitas requisições. Tente novamente em instantes.' });
    return false;
  }
  return true;
}
