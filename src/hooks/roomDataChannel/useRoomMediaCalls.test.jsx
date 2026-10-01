import { act, renderHook } from "@testing-library/react";
import { MAX_PARTICIPANT_CONNECTIONS } from "@/lib/room/peerLimits.mjs";
import {
  buildOutboundMediaStream,
  syncOutboundTracks,
} from "@/lib/webrtc/outboundMedia";
import { useRoomMediaCalls } from "./useRoomMediaCalls";

jest.mock("@/lib/webrtc/outboundMedia", () => ({
  buildOutboundMediaStream: jest.fn(),
  syncOutboundTracks: jest.fn(),
  pickOutboundVideoTrack: jest.fn(),
  resolveOutboundAudioTrack: jest.fn(),
}));

const ref = (current) => ({ current });

function setup(guestCount = 1) {
  const guests = Array.from({ length: guestCount }, (_, i) => `guest-${i}`);
  const peer = {
    call: jest.fn(() => ({
      on: jest.fn(),
      close: jest.fn(),
      peerConnection: { connectionState: "connected" },
    })),
  };
  const context = {
    isHost: true,
    peerRef: ref(peer),
    destroyedRef: ref(false),
    mediaCallsRef: ref(new Map()),
    preservingParticipantMediaCallsRef: ref(new WeakSet()),
    relayCallsRef: ref(new Map()),
    inboundStreamsRef: ref(new Map()),
    connectionsRef: ref(new Map(guests.map((id) => [id, {}]))),
    localStreamRef: ref({}),
    screenStreamRef: ref(null),
    onRemoteParticipantRef: ref(jest.fn()),
    onRemoteHostStreamRef: ref(jest.fn()),
    roomIdRef: ref("room"),
    send: jest.fn(),
  };
  const hook = renderHook(() => useRoomMediaCalls(context));
  return { ...hook, context, peer, guests };
}

beforeEach(() => {
  jest.clearAllMocks();
  buildOutboundMediaStream.mockResolvedValue({});
  syncOutboundTracks.mockResolvedValue(undefined);
});

it("finishes host synchronization and keeps later media changes flowing", async () => {
  const { result, peer } = setup();
  await act(async () => {
    await result.current.enqueueSync();
    await result.current.ensureMediaCall("guest-0");
    await result.current.enqueueSync({ screenStream: { id: "screen" } });
  });

  expect(peer.call).toHaveBeenCalledTimes(1);
  expect(syncOutboundTracks).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    { id: "screen" },
  );
});

it("recovers the queue after a media update rejects", async () => {
  const { result, peer } = setup();
  await act(async () => {
    await result.current.enqueueSync();
  });
  syncOutboundTracks.mockRejectedValueOnce(
    new Error("track replacement failed"),
  );
  await act(async () => {
    await expect(result.current.enqueueSync()).rejects.toThrow(
      "track replacement failed",
    );
    await result.current.enqueueSync();
  });
  expect(peer.call).toHaveBeenCalledTimes(1);
});

it("does not place a call after the peer changes during media preparation", async () => {
  const { result, context, peer } = setup(0);
  await act(async () => {
    await result.current.enqueueSync();
  });
  context.connectionsRef.current.set("guest-0", {});
  let finish;
  buildOutboundMediaStream.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    const pending = result.current.ensureMediaCall("guest-0");
    await Promise.resolve();
    context.peerRef.current = { call: jest.fn() };
    finish({});
    await pending;
  });
  expect(peer.call).not.toHaveBeenCalled();
  expect(context.peerRef.current.call).not.toHaveBeenCalled();
});

it("avoids duplicate or self relays at the default room capacity", async () => {
  const { result, context, peer, guests } = setup(MAX_PARTICIPANT_CONNECTIONS);
  await act(async () => {
    await result.current.enqueueSync();
    for (const id of guests) result.current.syncRelayForSource(id, {});
    for (const id of guests) result.current.syncRelayForViewer(id);
  });
  expect(context.mediaCallsRef.current.size).toBe(19);
  expect(context.relayCallsRef.current.size).toBe(342);
  expect(peer.call).toHaveBeenCalledTimes(361);
  for (const id of guests) {
    expect(context.relayCallsRef.current.has(`${id}:${id}`)).toBe(false);
  }
});
