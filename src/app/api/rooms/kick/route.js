import { guardPostRequest, RATE_LIMITS } from "@/lib/room/apiSecurity";
import {
  jsonError,
  jsonOk,
  readJsonBody,
  resolveHostRoomAuth,
} from "@/lib/room/routeHelpers";
import {
  getRoomById,
  kickDeviceFromRoom,
  restoreRoomFromToken,
} from "@/lib/room/store";
import { ROOM_ROLE } from "@/lib/room/tokens";

export const runtime = "nodejs";

export async function POST(request) {
  const blocked = await guardPostRequest(request, RATE_LIMITS.kick);
  if (blocked) return blocked;

  try {
    const body = await readJsonBody(request);
    const token = body?.token;
    const deviceId =
      typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
    const auth = resolveHostRoomAuth(token);
    if (auth.error) return auth.error;

    const { verified } = auth;
    if (verified.role !== ROOM_ROLE.HOST) {
      return jsonError("[E068] Host token required", 403);
    }

    if (!deviceId || deviceId.length > 128) {
      return jsonError("[E080] Participant device id required", 400);
    }

    let room = await getRoomById(verified.roomId, {
      joinCode: verified.joinCode,
    });
    if (!room) {
      room = await restoreRoomFromToken({
        roomId: verified.roomId,
        role: verified.role,
        token,
      });
    }
    if (!room) {
      return jsonError("[E076] Room not found", 404);
    }

    const kickedRoom = await kickDeviceFromRoom(verified.roomId, deviceId, {
      joinCode: room.joinCode ?? verified.joinCode,
    });
    if (!kickedRoom) {
      return jsonError("[E081] Failed to record kick", 500);
    }

    return jsonOk({
      roomId: verified.roomId,
      deviceId,
      kicked: true,
    });
  } catch (error) {
    console.error("[api/rooms/kick] failed", error);
    return jsonError("[E081] Failed to record kick", 500);
  }
}
