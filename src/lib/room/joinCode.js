import { randomBytes } from "node:crypto";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
// A join code is a bearer credential in the stateless room model. Eight
// characters from this alphabet provide roughly 37 bits of entropy.
const CODE_LENGTH = 8;

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
