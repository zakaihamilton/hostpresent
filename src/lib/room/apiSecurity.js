const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

const MAX_TOKEN_LENGTH = 2048;
const DEFAULT_MAX_BODY_BYTES = 16_384;

export function applySecurityHeaders(response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
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

export function guardPostRequest(request) {
  const validation = validateJsonPost(request);
  if (!validation.ok) {
    return applySecurityHeaders(
      Response.json({ error: validation.error }, { status: validation.status }),
    );
  }

  return null;
}
