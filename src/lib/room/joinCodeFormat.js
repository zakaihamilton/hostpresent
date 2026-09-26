const GROUP_SIZE = 3;
const JOIN_CODE_LENGTH = 9;
const JOIN_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
const JOIN_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ0-9]+$/;

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
  return (
    normalized.length === JOIN_CODE_LENGTH && JOIN_CODE_PATTERN.test(normalized)
  );
}

export { JOIN_CODE_CHARSET, JOIN_CODE_LENGTH };
