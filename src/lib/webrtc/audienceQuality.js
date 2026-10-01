export const PUBLISHER_VIDEO_CONSTRAINTS = Object.freeze({
  width: { ideal: 1280, max: 1280 },
  height: { ideal: 720, max: 720 },
  frameRate: { ideal: 15, max: 15 },
});
export const HOST_SEND_BUDGET = 12_000_000;
const applied = new WeakMap();
export function edgeQuality(edge, { hostId, focusedId, hostEdges = [] }) {
  const focused = edge.sourceId === focusedId;
  const monitor = edge.childId === hostId;
  const audio = edge.sourceId === hostId ? 64_000 : 48_000;
  const desired = focused || monitor ? 750_000 : 180_000;
  let video = desired;
  if (edge.parentId === hostId) {
    const audioBudget = hostEdges.reduce(
      (sum, item) => sum + (item.sourceId === hostId ? 64_000 : 48_000),
      0,
    );
    const focusEdges = hostEdges.filter(
      (item) => item.sourceId === focusedId,
    ).length;
    const otherEdges = hostEdges.length - focusEdges;
    const available = Math.max(0, HOST_SEND_BUDGET - audioBudget);
    // Reserve a live thumbnail for every other feed before allocating the
    // focused stream. A zero video cap would silently lose separate cameras.
    const thumbnailFloor = Math.min(
      40_000,
      available / Math.max(1, hostEdges.length),
    );
    const focusedBitrate = Math.min(
      750_000,
      Math.max(0, available - otherEdges * thumbnailFloor) /
        Math.max(1, focusEdges),
    );
    video = focused
      ? Math.min(desired, focusedBitrate)
      : Math.min(
          desired,
          Math.max(0, available - focusEdges * focusedBitrate) /
            Math.max(1, otherEdges),
        );
  }
  return {
    audio,
    video: Math.floor(video),
    maxFramerate: video < 60_000 ? 5 : video < 180_000 ? 8 : 15,
    height: focused || monitor ? 720 : video < 180_000 ? 180 : 360,
  };
}
export async function applyEdgeQuality(call, edge, options) {
  const quality = edgeQuality(edge, options);
  for (const sender of call?.peerConnection?.getSenders() ?? []) {
    const kind = sender.track?.kind ?? sender._hostPresentKind;
    if (!kind) continue;
    sender._hostPresentKind = kind;
    const height = sender.track?.getSettings?.().height || 720;
    const encoding =
      kind === "video"
        ? {
            maxBitrate: quality.video,
            maxFramerate: quality.maxFramerate,
            scaleResolutionDownBy: Math.max(1, height / quality.height),
          }
        : { maxBitrate: quality.audio };
    const signature = JSON.stringify(encoding);
    if (applied.get(sender) === signature) continue;
    try {
      const params = sender.getParameters();
      params.encodings = (
        params.encodings?.length ? params.encodings : [{}]
      ).map((item) => ({ ...item, ...encoding }));
      await sender.setParameters(params);
      applied.set(sender, signature);
    } catch {
      // Some browsers expose senders before negotiation completes. Retry on
      // the next health tick and after replacement rather than dropping media.
    }
  }
}
