// Env-driven rate limiter (backed by Beyond KV). Server-only.
//
// `@beyond.dev/rate-limit` is the real primitive — no hand-rolled counter math.
// Here we pin a sliding window of 10 requests/minute; swap the algorithm for
// `fixedWindow` / `tokenBucket`, or use the `rateLimit` singleton and configure
// it via BEYOND_RATE_LIMIT_* env vars instead.
import { createRateLimiter, slidingWindow } from "@beyond.dev/rate-limit";

export const noteLimiter = createRateLimiter({
  algorithm: slidingWindow({ limit: 10, window: 60_000 }), // 10 notes / minute / user
});
