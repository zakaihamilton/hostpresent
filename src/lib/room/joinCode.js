import { randomBytes } from "node:crypto";
import { JOIN_CODE_CHARSET, JOIN_CODE_LENGTH } from "./joinCodeFormat.js";

// Nine characters from this 34-symbol alphabet provide about 46 bits of entropy.
const CODE_LENGTH = JOIN_CODE_LENGTH;

export function createJoinCode() {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += JOIN_CODE_CHARSET[bytes[i] % JOIN_CODE_CHARSET.length];
  }
  return code;
}

export {
  formatJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
} from "./joinCodeFormat.js";
