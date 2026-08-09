import { TextDecoder, TextEncoder } from "node:util";
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

export const BODY_TOO_LARGE = Symbol("body-too-large");

export async function readJsonBody(request, { maxBytes = 16_384 } = {}) {
  try {
    const reader = request.body?.getReader?.();
    if (!reader) {
      const text = await request.text();
      if (new TextEncoder().encode(text).byteLength > maxBytes) {
        return BODY_TOO_LARGE;
      }
      return JSON.parse(text);
    }

    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return BODY_TOO_LARGE;
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
