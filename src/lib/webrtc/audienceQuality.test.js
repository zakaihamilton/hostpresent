import {
  applyEdgeQuality,
  edgeQuality,
  HOST_SEND_BUDGET,
} from "./audienceQuality";
import { buildRelayTrees } from "./relayTopology";

it("prioritizes focused video and keeps all fallback audio inside the host budget", () => {
  const members = Array.from({ length: 19 }, (_, i) => ({ id: `p${i}` }));
  const edges = buildRelayTrees({
    hostId: "host",
    members,
    publishers: ["host", "p0", "p1", "p2"],
  });
  const hostEdges = edges.filter((edge) => edge.parentId === "host");
  const options = { hostId: "host", focusedId: "p0", hostEdges };
  const qualities = hostEdges.map((edge) => edgeQuality(edge, options));
  expect(
    qualities.reduce((sum, q) => sum + q.audio + q.video, 0),
  ).toBeLessThanOrEqual(HOST_SEND_BUDGET);
  expect(qualities.every((q) => q.audio >= 48_000)).toBe(true);
  expect(qualities.every((q) => q.video > 0)).toBe(true);
  expect(
    hostEdges
      .filter((edge) => edge.sourceId === "p0")
      .map((edge) => edgeQuality(edge, options).video)
      .every((bitrate) => bitrate > 180_000),
  ).toBe(true);
  expect(qualities.some((q) => q.height === 180 && q.maxFramerate <= 8)).toBe(
    true,
  );
});
it("upgrades sender limits after focus and rechecks replacement track resolution", async () => {
  const sender = {
    track: { kind: "video", getSettings: () => ({ height: 720 }) },
    getParameters: () => ({}),
    setParameters: jest.fn().mockResolvedValue(undefined),
  };
  const call = { peerConnection: { getSenders: () => [sender] } };
  const edge = { sourceId: "p1", parentId: "p2", childId: "p3" };
  await applyEdgeQuality(call, edge, { hostId: "host", focusedId: "host" });
  expect(sender.setParameters).toHaveBeenLastCalledWith({
    encodings: [
      { maxBitrate: 180_000, maxFramerate: 15, scaleResolutionDownBy: 2 },
    ],
  });
  await applyEdgeQuality(call, edge, { hostId: "host", focusedId: "p1" });
  expect(sender.setParameters).toHaveBeenLastCalledWith({
    encodings: [
      { maxBitrate: 750_000, maxFramerate: 15, scaleResolutionDownBy: 1 },
    ],
  });
});
