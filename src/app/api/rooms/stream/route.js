import {
  applySecurityHeaders,
  guardGetRequest,
  RATE_LIMITS,
} from "@/lib/room/apiSecurity";
import { subscribeToRoom } from "@/lib/room/pubsub";
import {
  getSearchParam,
  verifyRequestToken,
} from "@/lib/room/routeHelpers";
import { getRoomById, restoreRoomFromToken } from "@/lib/room/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request) {
  const blocked = await guardGetRequest(request, RATE_LIMITS.stream);
  if (blocked) return blocked;

  const token = getSearchParam(request, "token");
  const auth = verifyRequestToken(token);
  if (auth.error) return auth.error;

  const { verified } = auth;
  let room = await getRoomById(verified.roomId);
  if (!room) {
    room = await restoreRoomFromToken({
      roomId: verified.roomId,
      role: verified.role,
      token,
    });
  }

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeatTimer = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (eventName, data) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(
            `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      };

      if (room.status === "open") {
        sendEvent("room_opened", { roomId: verified.roomId });
      }

      unsubscribe = subscribeToRoom(verified.roomId, (event) => {
        if (event.type === "room_opened") {
          sendEvent("room_opened", { roomId: event.roomId });
          return;
        }
        if (event.type === "signaling") {
          sendEvent("signaling", event.message);
        }
      });

      heartbeatTimer = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15000);
    },
    cancel() {
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      unsubscribe();
    },
  });

  return applySecurityHeaders(
    new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    }),
  );
}
