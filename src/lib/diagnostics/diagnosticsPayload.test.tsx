import { validateDiagnosticPayload } from "./diagnosticsPayload";

const payload = {
  event: "diagnostics_report",
  code: "diagnostics_requested",
  correlationId: "1b83a6b7-9e66-43e2-b808-80516f0f8d90",
  details: {
    connectionStatus: "connected",
    activeConnections: 1,
    hasTurn: true,
  },
};

describe("validateDiagnosticPayload", () => {
  it("keeps only the allow-listed diagnostic fields", () => {
    expect(
      validateDiagnosticPayload({ ...payload, roomId: "private-room" }),
    ).toEqual(payload);
  });

  it("rejects invalid event and connection data", () => {
    expect(
      validateDiagnosticPayload({ ...payload, event: "raw_error" }),
    ).toBeNull();
    expect(
      validateDiagnosticPayload({
        ...payload,
        details: { ...payload.details, activeConnections: 31 },
      }),
    ).toBeNull();
  });
});
