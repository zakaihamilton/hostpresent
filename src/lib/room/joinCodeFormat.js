const GROUP_SIZE = 3;

export function normalizeJoinCode(code) {
  if (typeof code !== "string") return "";
  return code.replace(/[\s-]+/g, "").toUpperCase();
}

export function formatJoinCode(code) {
  const normalized = normalizeJoinCode(code);
  if (!normalized) return "";
  return (
    normalized.match(new RegExp(`.{1,${GROUP_SIZE}}`, "g"))?.join("-") ??
    normalized
  );
}

export function isValidJoinCode(code) {
  const normalized = normalizeJoinCode(code);
  if (/^[A-Z]{6,8}$/.test(normalized)) return true;
  return /^[23456789A-Z]{6,12}$/.test(normalized);
}
