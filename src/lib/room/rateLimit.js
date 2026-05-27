const GLOBAL_KEY = "__hostpresentRateLimitStore";

function getMemoryStore() {
  let store = globalThis[GLOBAL_KEY];
  if (!store || typeof store !== "object") {
    store = new Map();
    globalThis[GLOBAL_KEY] = store;
  }
  return store;
}

async function getKvClient() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }

  try {
    const { kv } = await import("@vercel/kv");
    if (typeof kv?.incr !== "function") {
      return null;
    }
    return kv;
  } catch {
    return null;
  }
}

function rateLimitKey(key) {
  return `ratelimit:${key}`;
}

async function incrementCounter(key, windowMs) {
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  const kv = await getKvClient();

  if (kv) {
    try {
      const storageKey = rateLimitKey(key);
      const count = await kv.incr(storageKey);
      if (count === 1) {
        await kv.expire(storageKey, ttlSeconds);
      }
      const ttl = await kv.ttl(storageKey);
      const retryAfterMs =
        typeof ttl === "number" && ttl > 0 ? ttl * 1000 : windowMs;
      return { count, retryAfterMs };
    } catch (error) {
      console.warn("[rate limit] KV increment failed, using memory", error);
    }
  }

  const store = getMemoryStore();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { count: 1, retryAfterMs: windowMs };
  }

  const count = existing.count + 1;
  store.set(key, { count, resetAt: existing.resetAt });
  return { count, retryAfterMs: existing.resetAt - now };
}

export async function checkRateLimit({ key, limit, windowMs }) {
  const { count, retryAfterMs } = await incrementCounter(key, windowMs);
  const allowed = count <= limit;

  return {
    allowed,
    remaining: Math.max(0, limit - count),
    retryAfterMs,
  };
}

export const RATE_LIMITS = {
  createRoom: { name: "create", limit: 20, windowMs: 60 * 60 * 1000 },
  resolve: { name: "resolve", limit: 60, windowMs: 60 * 1000 },
  state: { name: "state", limit: 120, windowMs: 60 * 1000 },
  open: { name: "open", limit: 30, windowMs: 60 * 1000 },
  messages: { name: "messages", limit: 300, windowMs: 60 * 1000 },
  messagesPerRoom: { name: "messages-room", limit: 120, windowMs: 60 * 1000 },
  stream: { name: "stream", limit: 15, windowMs: 60 * 1000 },
  config: { name: "config", limit: 120, windowMs: 60 * 1000 },
};
