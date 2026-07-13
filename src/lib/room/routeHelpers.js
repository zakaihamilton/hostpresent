import { applySecurityHeaders } from "./apiSecurity.js";
import { inspectRoomToken, TOKEN_FAILURE } from "./tokens.js";

export function jsonOk(body, init) {
  return applySecurityHeaders(Response.json(body, init));
}

export function jsonError(message, status = 400) {
  return jsonOk({ error: message }, { status });
}

export function getSearchParam(request, name) {
  return new URL(request.url).searchParams.get(name);
}

export function verifyRequestToken(token) {
  if (!token || typeof token !== "string") {
    return { error: jsonError("[E065] Token required", 401) };
  }

  if (token.length > 2048) {
    return { error: jsonError("[E066] Invalid token", 401) };
  }

  const inspection = inspectRoomToken(token);
  if (inspection.ok) {
    return { verified: inspection.verified };
  }

  if (inspection.reason === TOKEN_FAILURE.EXPIRED) {
    return {
      error: jsonError("[E077] Token expired", 401),
      expired: true,
      verified: inspection.verified,
    };
  }

  return { error: jsonError("[E066] Invalid token", 401) };
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
