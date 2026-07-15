import {
  closeRelayCallsForSource,
  closeRelayCallsForViewer,
  ensureRelayCall,
} from "./relayCalls";

function makeCall() {
  return { close: jest.fn(), on: jest.fn() };
}

describe("relay calls", () => {
  it("closes only relay calls belonging to the departing viewer", () => {
    const viewerCall = makeCall();
    const otherCall = makeCall();
    const calls = new Map([
      ["viewer:source", viewerCall],
      ["other:source", otherCall],
    ]);

    closeRelayCallsForViewer(calls, "viewer");

    expect(viewerCall.close).toHaveBeenCalled();
    expect(calls.has("other:source")).toBe(true);
  });

  it("does not create duplicate relay calls", () => {
    const calls = new Map();
    const peer = { call: jest.fn(() => makeCall()) };
    const streams = new Map([["source", {}]]);

    ensureRelayCall({
      relayCalls: calls,
      inboundStreams: streams,
      peer,
      viewerId: "viewer",
      sourceId: "source",
    });
    ensureRelayCall({
      relayCalls: calls,
      inboundStreams: streams,
      peer,
      viewerId: "viewer",
      sourceId: "source",
    });

    expect(peer.call).toHaveBeenCalledTimes(1);
  });

  it("removes source relays and the source stream", () => {
    const call = makeCall();
    const calls = new Map([["viewer:source", call]]);
    const streams = new Map([["source", {}]]);

    closeRelayCallsForSource(calls, streams, "source");

    expect(call.close).toHaveBeenCalled();
    expect(streams.has("source")).toBe(false);
  });
});
