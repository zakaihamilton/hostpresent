import {
  MAX_PARTICIPANT_CONNECTIONS,
  TARGET_PARTICIPANT_CONNECTIONS,
} from "./peerLimits.mjs";

it("supports nineteen attendees by default", () => {
  expect(TARGET_PARTICIPANT_CONNECTIONS).toBe(19);
  expect(MAX_PARTICIPANT_CONNECTIONS).toBe(19);
});
