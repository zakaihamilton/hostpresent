import {
  applySecurityHeaders,
  guardGetRequest,
  RATE_LIMITS,
} from "@/lib/room/apiSecurity";
import {
  getSearchParam,
  verifyRequestToken,
} from "@/lib/room/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const blocked = await guardGetRequest(request, RATE_LIMITS.stream);
  if (blocked) return blocked;

  const token = getSearchParam(request, "token");
  const auth = verifyRequestToken(token);
  if (auth.error) return auth.error;

  const { verified } = auth;
  const encoder = new TextEncoder();
  let heartbeatTimer = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: room_opened\ndata: ${JSON.stringify({ roomId: verified.roomId })}\n\n`,
        ),
      );

      heartbeatTimer = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15000);
    },
    cancel() {
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
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
