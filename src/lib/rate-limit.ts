/**
 * Lightweight in-memory sliding-window rate limiter for API routes.
 * Includes periodic pruning so memory stays bounded under high traffic.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
let lastPruneAt = Date.now();
const PRUNE_INTERVAL_MS = 5 * 60_000;

function pruneExpired(now: number, maxWindowMs: number) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  const cutoff = now - maxWindowMs;
  for (const [key, bucket] of buckets.entries()) {
    const fresh = bucket.timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) {
      buckets.delete(key);
    } else {
      bucket.timestamps = fresh;
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  pruneExpired(now, Math.max(windowMs, 60 * 60_000));

  const cutoff = now - windowMs;
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export function rateLimitResponse(
  retryAfterSeconds: number,
  message = "Too many requests. Please slow down and try again shortly.",
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

