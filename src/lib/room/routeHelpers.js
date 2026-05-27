import { applySecurityHeaders } from "./apiSecurity.js";
import { verifyRoomToken } from "./tokens.js";

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
    return { error: jsonError("Token required", 401) };
  }

  if (token.length > 2048) {
    return { error: jsonError("Invalid token", 401) };
  }

  const verified = verifyRoomToken(token);
  if (!verified) {
    return { error: jsonError("Invalid token", 401) };
  }
  return { verified };
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
