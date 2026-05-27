import {
  DEFAULT_DISPLAY_NAME,
  loadDisplayName,
  loadParticipantMode,
  normalizeDisplayNameInput,
  PARTICIPANT_MODE,
  resolveDisplayName,
  saveDisplayName,
  saveParticipantMode,
} from "./displayNameSettings";

describe("displayNameSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("normalizes and resolves display names", () => {
    expect(normalizeDisplayNameInput("  Alex  ")).toBe("Alex");
    expect(resolveDisplayName("")).toBe(DEFAULT_DISPLAY_NAME);
    expect(resolveDisplayName("Sam")).toBe("Sam");
  });

  it("persists display name and participant mode", () => {
    saveDisplayName("Jordan");
    saveParticipantMode(PARTICIPANT_MODE.LISTENING);

    expect(loadDisplayName()).toBe("Jordan");
    expect(loadParticipantMode()).toBe(PARTICIPANT_MODE.LISTENING);
  });
});
