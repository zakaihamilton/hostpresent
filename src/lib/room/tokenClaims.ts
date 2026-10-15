function fromBase64Url(value) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("utf8");
  }
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function readRoomTokenClaims(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [payloadPart] = token.split(".");
  if (!payloadPart) return null;

  try {
    return JSON.parse(fromBase64Url(payloadPart));
  } catch {
    return null;
  }
}

export function readRoomTokenRole(token) {
  const role = readRoomTokenClaims(token)?.role;
  return role === "host" || role === "participant" ? role : null;
}
