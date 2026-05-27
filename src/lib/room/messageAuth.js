import { ROOM_ROLE } from "@/lib/room/tokens";
import { SIGNALING_MESSAGE } from "@/lib/signaling/messages";

const HOST_ONLY_TYPES = new Set([
  SIGNALING_MESSAGE.HOST_PRESENT,
  SIGNALING_MESSAGE.HOST_MUTE_AUDIO,
  SIGNALING_MESSAGE.HOST_MUTE_VIDEO,
  SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO,
  SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO,
]);

export function canRelayMessage({ role, message }) {
  if (!message?.type) return false;
  if (HOST_ONLY_TYPES.has(message.type)) {
    return role === ROOM_ROLE.HOST;
  }
  return true;
}
