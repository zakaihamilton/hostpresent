import { checkRateLimit, RATE_LIMITS } from "./rateLimit.js";

export { RATE_LIMITS };

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

const MAX_TOKEN_LENGTH = 2048;
const DEFAULT_MAX_BODY_BYTES = 16_384;

export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export function applySecurityHeaders(response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

export function jsonRateLimited(retryAfterMs) {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return applySecurityHeaders(
    Response.json(
      { error: "[E060] Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    ),
  );
}

export async function enforceRateLimit(
  request,
  { name, limit, windowMs, keySuffix },
) {
  const ip = getClientIp(request);
  const key = keySuffix ? `${name}:${ip}:${keySuffix}` : `${name}:${ip}`;
  const result = await checkRateLimit({ key, limit, windowMs });

  if (!result.allowed) {
    return jsonRateLimited(result.retryAfterMs);
  }

  return null;
}

export function validateTokenParam(token) {
  if (!token || typeof token !== "string") {
    return { ok: false, error: "[E061] Token required" };
  }

  if (token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, error: "[E062] Token too long" };
  }

  return { ok: true };
}

export function validateJsonPost(
  request,
  { maxBodyBytes = DEFAULT_MAX_BODY_BYTES } = {},
) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength === 0) {
    return { ok: true };
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      ok: false,
      status: 415,
      error: "[E063] Content-Type must be application/json",
    };
  }

  if (contentLength > maxBodyBytes) {
    return { ok: false, status: 413, error: "[E064] Request body too large" };
  }

  return { ok: true };
}

export async function guardGetRequest(request, rateLimit) {
  const limited = await enforceRateLimit(request, rateLimit);
  if (limited) return limited;
  return null;
}

export async function guardPostRequest(request, rateLimit) {
  const validation = validateJsonPost(request);
  if (!validation.ok) {
    return applySecurityHeaders(
      Response.json({ error: validation.error }, { status: validation.status }),
    );
  }

  const limited = await enforceRateLimit(request, rateLimit);
  if (limited) return limited;
  return null;
}
