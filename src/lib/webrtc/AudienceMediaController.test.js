import { AudienceMediaController } from "./AudienceMediaController";
import { MEDIA_CONTROL, MEDIA_PROTOCOL_VERSION } from "./audienceProtocol";

let serial;
const controllers = [];
function make(overrides = {}) {
  const options = {
    isHost: true,
    localId: "host",
    hostId: "host",
    getPeer: () => ({ call: jest.fn() }),
    getLocalStream: async () => null,
    sendControl: jest.fn(),
    onStream: jest.fn(),
    onState: jest.fn(),
    rejectPeer: jest.fn(),
    createId: () => `id${serial++}`,
    ...overrides,
  };
  const controller = new AudienceMediaController(options);
  controllers.push(controller);
  return { controller, ...options };
}
function join(controller, id) {
  controller.connectionOpen(id);
  controller.handleControl(id, {
    type: MEDIA_CONTROL.HELLO,
    participantId: id,
    version: MEDIA_PROTOCOL_VERSION,
    foreground: true,
    desktop: true,
    forwarding: true,
  });
}
function request(controller, id) {
  controller.handleControl(id, {
    type: MEDIA_CONTROL.REQUEST,
    participantId: id,
    request: true,
  });
}
function plan(overrides = {}) {
  return {
    type: MEDIA_CONTROL.PLAN,
    version: MEDIA_PROTOCOL_VERSION,
    epoch: "epoch1",
    revision: 1,
    publishers: ["host"],
    focusedId: "host",
    edges: [
      {
        id: "edge1",
        sourceId: "host",
        parentId: "host",
        childId: "p1",
        fallback: false,
      },
    ],
    ...overrides,
  };
}
function call(overrides = {}) {
  const events = new Map();
  return {
    peer: "host",
    metadata: {
      version: MEDIA_PROTOCOL_VERSION,
      epoch: "epoch1",
      edgeId: "edge1",
      sourceId: "host",
    },
    close: jest.fn(),
    answer: jest.fn(),
    peerConnection: { connectionState: "connected" },
    on: (event, handler) => events.set(event, handler),
    emit: (event, value) => events.get(event)?.(value),
    ...overrides,
  };
}
beforeEach(() => {
  serial = 0;
  jest.useFakeTimers();
});
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  jest.useRealTimers();
});
it("enforces three guest slots and requires a connected request from that guest", () => {
  const { controller } = make();
  for (const id of ["p1", "p2", "p3", "p4"]) {
    join(controller, id);
    request(controller, id);
  }
  expect(controller.approve("p1")).toBe(true);
  expect(controller.approve("p2")).toBe(true);
  expect(controller.approve("p3")).toBe(true);
  expect(controller.approve("p4")).toBe(false);
  expect(controller.approve("outsider")).toBe(false);
  controller.revoke("p2");
  expect(controller.approve("p4")).toBe(true);
  controller.connectionClose("p1");
  expect(controller.guests.has("p1")).toBe(false);
});
it("ignores participant attempts to grant publishing or request on behalf of someone else", () => {
  const { controller } = make();
  join(controller, "p1");
  join(controller, "p2");
  controller.handleControl("p1", {
    ...plan({ publishers: ["host", "p1"] }),
    participantId: "p1",
  });
  controller.handleControl("p1", {
    type: MEDIA_CONTROL.REQUEST,
    participantId: "p2",
    request: true,
  });
  expect(controller.guests.size).toBe(0);
  expect(controller.requests.size).toBe(0);
  const unauthorized = call({ peer: "p1" });
  expect(controller.handleCall(unauthorized)).toBe(false);
  expect(unauthorized.close).toHaveBeenCalled();
});
it("rejects incorrect parent, source, epoch and edge; answers assigned media without capturing or echoing", () => {
  const { controller, getLocalStream, onStream } = make({
    isHost: false,
    localId: "p1",
    getLocalStream: jest.fn(),
  });
  controller.connectionOpen("host");
  controller.handleControl("host", plan());
  for (const bad of [
    call({ peer: "p2" }),
    call({ metadata: { ...call().metadata, sourceId: "p1" } }),
    call({ metadata: { ...call().metadata, epoch: "old" } }),
    call({ metadata: { ...call().metadata, edgeId: "wrong" } }),
  ])
    expect(controller.handleCall(bad)).toBe(false);
  const accepted = call();
  expect(controller.handleCall(accepted)).toBe(true);
  expect(accepted.answer).toHaveBeenCalledWith();
  expect(getLocalStream).not.toHaveBeenCalled();
  const stream = { getTracks: () => [] };
  accepted.emit("stream", stream);
  expect(onStream).toHaveBeenCalledWith("host", stream);
});
it("rejects stale revisions, retired epochs and forged host assignments", () => {
  const { controller } = make({ isHost: false, localId: "p1" });
  controller.connectionOpen("host");
  controller.handleControl("p2", plan());
  expect(controller.plan).toBeNull();
  controller.handleControl("host", plan({ revision: 2 }));
  controller.handleControl(
    "host",
    plan({ revision: 1, publishers: ["host", "p1"] }),
  );
  expect(controller.plan.revision).toBe(2);
  controller.handleControl("host", plan({ epoch: "epoch2" }));
  controller.handleControl("host", plan({ revision: 3 }));
  expect(controller.epoch).toBe("epoch2");
});
it("retains the current feed during repair and ignores late close events", () => {
  const { controller, onStream } = make({ isHost: false, localId: "p1" });
  controller.connectionOpen("host");
  controller.handleControl("host", plan());
  const old = call();
  controller.handleCall(old);
  old.emit("stream", { getTracks: () => [] });
  const replacementPlan = plan({
    revision: 2,
    edges: [{ ...plan().edges[0], id: "edge2", parentId: "p2" }],
  });
  controller.handleControl("host", replacementPlan);
  expect(old.close).not.toHaveBeenCalled();
  const replacement = call({
    peer: "p2",
    metadata: { ...call().metadata, edgeId: "edge2" },
  });
  controller.handleCall(replacement);
  const next = { getTracks: () => [] };
  replacement.emit("stream", next);
  expect(old.close).toHaveBeenCalled();
  old.emit("close");
  expect(controller.streams.get("host")).toBe(next);
  expect(onStream).not.toHaveBeenCalledWith("host", null);
});
it("repairs a failed branch after five seconds and preserves other healthy edges", () => {
  let now = 0;
  const { controller } = make({ now: () => now });
  for (let i = 0; i < 8; i++) join(controller, `p${i}`);
  const broken = controller.edges.find((edge) => edge.parentId !== "host");
  const report = () =>
    controller.handleControl(broken.childId, {
      type: MEDIA_CONTROL.HEALTH,
      participantId: broken.childId,
      foreground: true,
      desktop: true,
      forwarding: true,
      edges: [{ id: broken.id, ready: false }],
    });
  report();
  now = 4999;
  report();
  expect(controller.edges).toContainEqual(broken);
  now = 5000;
  report();
  expect(controller.edges).not.toContainEqual(broken);
  expect(controller.edges).toHaveLength(8);
});
it("resets publishing immediately when host control closes and requires a new grant", () => {
  const { controller, onState } = make({ isHost: false, localId: "p1" });
  controller.connectionOpen("host");
  controller.handleControl("host", plan({ publishers: ["host", "p1"] }));
  expect(onState).toHaveBeenLastCalledWith(
    expect.objectContaining({ canPublish: true }),
  );
  controller.connectionClose("host");
  expect(onState).toHaveBeenLastCalledWith(
    expect.objectContaining({ canPublish: false }),
  );
  controller.connectionOpen("host");
  expect(onState).toHaveBeenLastCalledWith(
    expect.objectContaining({ canPublish: false }),
  );
});
it("asks incompatible clients to reload without granting publishing", () => {
  const { controller, sendControl, rejectPeer } = make();
  controller.connectionOpen("old");
  controller.handleControl("old", {
    type: MEDIA_CONTROL.HELLO,
    participantId: "old",
    version: 1,
  });
  expect(sendControl).toHaveBeenCalledWith(
    "old",
    expect.objectContaining({ type: MEDIA_CONTROL.RELOAD }),
  );
  expect(rejectPeer).toHaveBeenCalledWith("old");
});
it("starts a fresh host epoch and drops all guest grants on signaling reconnection", () => {
  const { controller } = make();
  join(controller, "p1");
  request(controller, "p1");
  controller.approve("p1");
  const epoch = controller.epoch;
  controller.restartEpoch();
  expect(controller.epoch).not.toBe(epoch);
  expect(controller.guests.size).toBe(0);
  expect(controller.plan.publishers).toEqual(["host"]);
  expect(controller.members.get("p1").negotiated).toBe(true);
});
it("clears retained media when a source is revoked after its old call closed", () => {
  const { controller, onStream } = make({ isHost: false, localId: "p1" });
  controller.connectionOpen("host");
  const initial = plan({
    publishers: ["host", "p2"],
    edges: [{ ...plan().edges[0], sourceId: "p2", parentId: "p2" }],
  });
  controller.handleControl("host", initial);
  const incoming = call({
    peer: "p2",
    metadata: { ...call().metadata, sourceId: "p2" },
  });
  controller.handleCall(incoming);
  incoming.emit("stream", { getTracks: () => [] });
  incoming.emit("close");
  controller.handleControl("host", plan({ revision: 2, edges: [] }));
  expect(controller.streams.has("p2")).toBe(false);
  expect(onStream).toHaveBeenCalledWith("p2", null);
});
it("forwards an assigned remote feed without ever acquiring a local stream", async () => {
  const getLocalStream = jest.fn();
  const outgoing = call({
    peerConnection: { getSenders: () => [], connectionState: "connected" },
  });
  const placeCall = jest.fn().mockReturnValue(outgoing);
  const { controller } = make({
    isHost: false,
    localId: "p1",
    getLocalStream,
    getPeer: () => ({ call: placeCall }),
  });
  controller.connectionOpen("host");
  controller.handleControl(
    "host",
    plan({
      edges: [
        ...plan().edges,
        {
          id: "forward",
          sourceId: "host",
          parentId: "p1",
          childId: "p2",
          fallback: false,
        },
      ],
    }),
  );
  const incoming = call();
  controller.handleCall(incoming);
  const stream = { getTracks: () => [{ kind: "video", readyState: "live" }] };
  incoming.emit("stream", stream);
  await controller.sync();
  expect(getLocalStream).not.toHaveBeenCalled();
  expect(placeCall).toHaveBeenCalledWith(
    "p2",
    stream,
    expect.objectContaining({
      metadata: expect.objectContaining({
        edgeId: "forward",
        sourceId: "host",
        epoch: "epoch1",
      }),
    }),
  );
});
