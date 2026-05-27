import { SIGNALING_MESSAGE } from "@/lib/signaling/messages";
import {
  canReceiveSignalingMessage,
  canRelayMessage,
  canSendSignalingMessage,
} from "./messageAuth.js";
import { ROOM_ROLE } from "./tokens.js";

describe("messageAuth", () => {
  it("allows only the host to send host mute commands", () => {
    const message = {
      type: SIGNALING_MESSAGE.HOST_MUTE_AUDIO,
      participantId: "guest-1",
      participantType: "video",
    };

    expect(
      canSendSignalingMessage({ isHost: true, message, localParticipantId: "" }),
    ).toBe(true);
    expect(
      canSendSignalingMessage({
        isHost: false,
        message,
        localParticipantId: "guest-1",
      }),
    ).toBe(false);
  });

  it("allows only participants to send their own status updates", () => {
    const message = {
      type: SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED,
      participantId: "guest-1",
      participantType: "video",
    };

    expect(
      canSendSignalingMessage({
        isHost: false,
        message,
        localParticipantId: "guest-1",
      }),
    ).toBe(true);
    expect(
      canSendSignalingMessage({
        isHost: false,
        message,
        localParticipantId: "guest-2",
      }),
    ).toBe(false);
    expect(
      canSendSignalingMessage({ isHost: true, message, localParticipantId: "" }),
    ).toBe(false);
  });

  it("lets participants receive host commands targeted at them", () => {
    const message = {
      type: SIGNALING_MESSAGE.HOST_MUTE_VIDEO,
      participantId: "guest-1",
    };

    expect(
      canReceiveSignalingMessage({
        isHost: false,
        message,
        senderId: "hp-room",
        localParticipantId: "guest-1",
      }),
    ).toBe(true);
    expect(
      canReceiveSignalingMessage({
        isHost: false,
        message,
        senderId: "hp-room",
        localParticipantId: "guest-2",
      }),
    ).toBe(false);
  });

  it("blocks participants from receiving other participant status messages", () => {
    const message = {
      type: SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED,
      participantId: "guest-2",
    };

    expect(
      canReceiveSignalingMessage({
        isHost: false,
        message,
        senderId: "guest-2",
        localParticipantId: "guest-1",
      }),
    ).toBe(false);
  });

  it("lets the host receive participant status only from the sender", () => {
    const message = {
      type: SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED,
      participantId: "guest-1",
      participantType: "video",
    };

    expect(
      canReceiveSignalingMessage({
        isHost: true,
        message,
        senderId: "guest-1",
        localParticipantId: "",
      }),
    ).toBe(true);
    expect(
      canReceiveSignalingMessage({
        isHost: true,
        message,
        senderId: "guest-2",
        localParticipantId: "",
      }),
    ).toBe(false);
    expect(
      canReceiveSignalingMessage({
        isHost: true,
        message: { type: SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO },
        senderId: "guest-1",
        localParticipantId: "",
      }),
    ).toBe(false);
  });

  it("matches server relay rules", () => {
    expect(
      canRelayMessage({
        role: ROOM_ROLE.HOST,
        message: { type: SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO },
      }),
    ).toBe(true);
    expect(
      canRelayMessage({
        role: ROOM_ROLE.PARTICIPANT,
        message: { type: SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO },
      }),
    ).toBe(false);
  });
});
