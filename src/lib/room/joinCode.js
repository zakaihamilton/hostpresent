import { randomBytes } from "node:crypto";
import { JOIN_CODE_LENGTH } from "./joinCodeFormat.js";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
// New 10-character codes provide about 46 bits of entropy. The resolver still
// Recognizes the 8-character shape so old links can show an expiration message.
const CODE_LENGTH = JOIN_CODE_LENGTH;

export function createJoinCode() {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}

export {
  formatJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
} from "./joinCodeFormat.js";
