import {
  buildRecordingFilename,
  formatRecordingDate,
  sanitizeRecordingSessionName,
} from "./recordingFilename";

describe("recordingFilename", () => {
  it("formats the local calendar date as YYYY-MM-DD", () => {
    expect(formatRecordingDate(new Date(2026, 4, 27, 23, 59))).toBe(
      "2026-05-27",
    );
  });

  it("builds filenames with date prefix, space, and session name", () => {
    expect(
      buildRecordingFilename({
        sessionName: "Host Present Meeting",
        date: new Date(2026, 4, 27, 12, 0),
      }),
    ).toBe("2026-05-27 Host Present Meeting.mp4");
  });

  it("sanitizes unsafe characters in the session name", () => {
    expect(sanitizeRecordingSessionName('Room: "A/B"')).toBe("Room- -A-B-");
    expect(
      buildRecordingFilename({
        sessionName: 'Room: "A/B"',
        date: new Date(2026, 4, 27),
      }),
    ).toBe("2026-05-27 Room- -A-B-.mp4");
  });

  it("falls back when session name is empty", () => {
    expect(
      buildRecordingFilename({
        sessionName: "   ",
        date: new Date(2026, 4, 27),
      }),
    ).toBe("2026-05-27 Host Present Meeting.mp4");
  });
});
