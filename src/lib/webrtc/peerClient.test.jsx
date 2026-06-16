import {
  getSignalingErrorHint,
  HOST_SIGNING_REACHABILITY_HINT,
  isFatalSignalingError,
  isSignalingConfigError,
  isSignalingRetryMessage,
  isSignalingServerReachabilityError,
  isWaitingForHostMessage,
  isWaitingForParticipantsMessage,
  peerErrorMessage,
  SIGNALING_CONNECT_TIMEOUT_MS,
  SIGNALING_ERROR,
} from "./peerClient";

describe("peerClient signaling errors", () => {
  it("uses a longer connect timeout", () => {
    expect(SIGNALING_CONNECT_TIMEOUT_MS).toBeGreaterThanOrEqual(45000);
  });

  it("treats config errors separately from reachability errors", () => {
    expect(isSignalingConfigError(SIGNALING_ERROR.NOT_CONFIGURED)).toBe(true);
    expect(isSignalingConfigError(SIGNALING_ERROR.CONFIG_LOAD_FAILED)).toBe(
      true,
    );
    expect(isSignalingConfigError(SIGNALING_ERROR.HOST_TIMEOUT)).toBe(false);
  });

  it("marks reachability failures as fatal but retry messages as non-fatal", () => {
    expect(
      isSignalingServerReachabilityError(SIGNALING_ERROR.HOST_TIMEOUT),
    ).toBe(true);
    expect(isSignalingRetryMessage(SIGNALING_ERROR.HOST_ID_RECONNECTING)).toBe(
      true,
    );
    expect(isFatalSignalingError(SIGNALING_ERROR.HOST_ID_RECONNECTING)).toBe(
      false,
    );
    expect(isFatalSignalingError(SIGNALING_ERROR.HOST_TIMEOUT)).toBe(true);
    expect(isWaitingForHostMessage("Waiting for the host to join…")).toBe(true);
    expect(isWaitingForParticipantsMessage(SIGNALING_ERROR.HOST_TIMEOUT)).toBe(
      false,
    );
    expect(
      isWaitingForParticipantsMessage("[E010] Waiting for participants…"),
    ).toBe(true);
    expect(isFatalSignalingError("Waiting for the host to join…")).toBe(false);
  });

  it("returns config hint for config errors and reachability hint otherwise", () => {
    expect(
      getSignalingErrorHint(SIGNALING_ERROR.NOT_CONFIGURED, { isHost: true }),
    ).toContain("SIGNALING_SERVER_URL");
    expect(
      getSignalingErrorHint(SIGNALING_ERROR.HOST_TIMEOUT, { isHost: true }),
    ).toBe(HOST_SIGNING_REACHABILITY_HINT);
  });

  it("formats peer error messages correctly with details and retrying status", () => {
    expect(
      peerErrorMessage({ type: "network", message: "DNS resolution failed" }),
    ).toBe(
      "[E008] Could not reach the signaling server. Check your connection and try again: DNS resolution failed. Retrying…",
    );

    expect(
      peerErrorMessage({ type: "invalid-key", message: "API key expired" }),
    ).toBe(
      "[E017] The signaling server API key is invalid or not found: API key expired.",
    );

    expect(
      peerErrorMessage({ type: "unknown-type", message: "something broke" }),
    ).toBe("[E012] Signaling connection failed: something broke.");
  });

  it("classifies fatal signaling errors correctly", () => {
    expect(
      isFatalSignalingError(
        peerErrorMessage({ type: "invalid-key", message: "API key expired" }),
      ),
    ).toBe(true);

    expect(isFatalSignalingError("[E011] Waiting for the host to join…")).toBe(
      false,
    );

    expect(isFatalSignalingError("[E010] Waiting for participants…")).toBe(
      false,
    );

    expect(isFatalSignalingError("Retrying…")).toBe(false);
    expect(isFatalSignalingError("Reconnecting…")).toBe(false);
  });
});
