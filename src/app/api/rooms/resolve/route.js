import { guardPostRequest } from "@/lib/room/apiSecurity";
import {
  isLegacyJoinCode,
  isValidJoinCode,
  normalizeJoinCode,
} from "@/lib/room/joinCodeFormat";
import { deriveRoomIdFromJoinCode } from "@/lib/room/roomIdentity";
import {
  BODY_TOO_LARGE,
  jsonError,
  jsonOk,
  readJsonBody,
} from "@/lib/room/routeHelpers";
import { ROOM_ROLE, signRoomToken } from "@/lib/room/tokens";

export const runtime = "nodejs";

export async function POST(request) {
  const blocked = guardPostRequest(request, { maxBodyBytes: 512 });
  if (blocked) return blocked;

  const body = await readJsonBody(request, { maxBytes: 512 });
  if (body === BODY_TOO_LARGE) {
    return jsonError("[E064] Request body too large", 413);
  }

  const joinCode = normalizeJoinCode(
    typeof body?.code === "string" ? body.code : "",
  );

  if (isLegacyJoinCode(joinCode)) {
    return jsonError(
      "[E091] This 8-character invite code has expired. Ask the host for a new 10-character code.",
      410,
    );
  }

  if (!isValidJoinCode(joinCode)) {
    return jsonError("[E075] Invalid join code", 400);
  }

  const roomId = deriveRoomIdFromJoinCode(joinCode);
  if (!roomId) return jsonError("[E083] Room signing is not configured", 503);
  const participantToken = signRoomToken({
    roomId,
    role: ROOM_ROLE.PARTICIPANT,
    joinCode,
  });
  if (!participantToken)
    return jsonError("[E083] Room signing is not configured", 503);

  return jsonOk({
    roomId,
    joinCode,
    participantToken,
  });
}
