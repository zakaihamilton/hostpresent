const GROUP_SIZE = 4;
const JOIN_CODE_LENGTH = 10;
const LEGACY_JOIN_CODE_LENGTH = 8;

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

export function isLegacyJoinCode(code) {
  const normalized = normalizeJoinCode(code);
  return (
    normalized.length === LEGACY_JOIN_CODE_LENGTH &&
    /^[ABCDEFGHJKLMNPQRSTUVWXYZ]+$/.test(normalized)
  );
}

export function isValidJoinCode(code) {
  const normalized = normalizeJoinCode(code);
  return (
    (normalized.length === JOIN_CODE_LENGTH ||
      normalized.length === LEGACY_JOIN_CODE_LENGTH) &&
    /^[ABCDEFGHJKLMNPQRSTUVWXYZ]+$/.test(normalized)
  );
}

export { JOIN_CODE_LENGTH, LEGACY_JOIN_CODE_LENGTH };
