import { getAutoFocusTargetId } from "./autoFocus";

describe("getAutoFocusTargetId", () => {
  const defaults = {
    focusedParticipantId: "",
    videoParticipants: [],
    isHost: true,
    localIsSpeaking: false,
    localVideoAvailable: true,
    hostIsSpeaking: false,
    hostVideoAvailable: true,
  };

  it("does not auto-focus a speaking participant whose camera is off", () => {
    expect(
      getAutoFocusTargetId({
        ...defaults,
        videoParticipants: [
          { id: "participant-1", isSpeaking: true, isVideoMuted: true },
        ],
      }),
    ).toBe("host");
  });

  it("returns to a speaking participant as soon as their camera is back on", () => {
    const participant = {
      id: "participant-1",
      isSpeaking: true,
      isVideoMuted: true,
    };

    expect(
      getAutoFocusTargetId({
        ...defaults,
        videoParticipants: [participant],
      }),
    ).toBe("host");

    expect(
      getAutoFocusTargetId({
        ...defaults,
        videoParticipants: [{ ...participant, isVideoMuted: false }],
      }),
    ).toBe("participant-1");
  });

  it("keeps a manual focus selection regardless of camera state", () => {
    expect(
      getAutoFocusTargetId({
        ...defaults,
        focusedParticipantId: "participant-1",
        videoParticipants: [
          { id: "participant-2", isSpeaking: true, isVideoMuted: false },
        ],
      }),
    ).toBe("participant-1");
  });
});
