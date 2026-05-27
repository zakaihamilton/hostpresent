import { normalizeJoinCode } from "@/lib/room/joinCodeFormat";

export function dedupeRoomsByJoinCode(rooms, getRecentTime) {
  const sorted = [...rooms].sort(
    (a, b) => getRecentTime(b) - getRecentTime(a),
  );
  const seenJoinCodes = new Set();
  const deduped = [];

  for (const room of sorted) {
    const joinCode = normalizeJoinCode(room.joinCode ?? "");
    if (joinCode) {
      if (seenJoinCodes.has(joinCode)) continue;
      seenJoinCodes.add(joinCode);
    }
    deduped.push(room);
  }

  return deduped;
}
