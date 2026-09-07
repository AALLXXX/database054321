import { tooMany } from "./errors";

interface Bucket {
  count: number;
  resetAt: number;
}

const globalRef = globalThis as unknown as { __alexRate?: Map<string, Bucket> };
const buckets = (globalRef.__alexRate ??= new Map<string, Bucket>());

/**
 * Rate limiter sederhana per-instance (in-memory). Di serverless setiap instance
 * punya counter sendiri, tapi tetap efektif menahan brute-force dari satu IP.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return;
  }
  b.count += 1;
  if (b.count > limit) throw tooMany();
}
