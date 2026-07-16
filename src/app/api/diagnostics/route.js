import { validateDiagnosticPayload } from "@/lib/diagnostics/diagnosticsPayload";
import {
  createRequestId,
  logServerEvent,
} from "@/lib/observability/structuredLog";
import { guardPostRequest } from "@/lib/room/apiSecurity";
import { jsonError, jsonOk, readJsonBody } from "@/lib/room/routeHelpers";

export const runtime = "nodejs";

export async function POST(request) {
  const blocked = guardPostRequest(request, { maxBodyBytes: 2_048 });
  if (blocked) return blocked;

  const payload = validateDiagnosticPayload(await readJsonBody(request));
  if (!payload) return jsonError("[E090] Invalid diagnostic payload", 400);

  logServerEvent("client_diagnostic", {
    requestId: createRequestId(),
    ...payload,
  });
  return jsonOk({ ok: true });
}
