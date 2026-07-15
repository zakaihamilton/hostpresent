export const relayCallKey = (viewerId, sourceId) => `${viewerId}:${sourceId}`;

export function closeRelayCallsForViewer(relayCalls, viewerId) {
  for (const [key, call] of relayCalls.entries()) {
    if (key.startsWith(`${viewerId}:`)) {
      call.close();
      relayCalls.delete(key);
    }
  }
}

export function closeRelayCallsForSource(relayCalls, inboundStreams, sourceId) {
  for (const [key, call] of relayCalls.entries()) {
    if (key.endsWith(`:${sourceId}`)) {
      call.close();
      relayCalls.delete(key);
    }
  }
  inboundStreams.delete(sourceId);
}

export function ensureRelayCall({
  relayCalls,
  inboundStreams,
  peer,
  viewerId,
  sourceId,
  onFailure = () => {},
}) {
  if (viewerId === sourceId) return;
  const stream = inboundStreams.get(sourceId);
  if (!stream || !peer) return;

  const key = relayCallKey(viewerId, sourceId);
  if (relayCalls.has(key)) return;
  try {
    const call = peer.call(viewerId, stream, {
      metadata: { relayFrom: sourceId },
    });
    if (!call) return;
    relayCalls.set(key, call);
    call.on("close", () => {
      if (relayCalls.get(key) === call) relayCalls.delete(key);
    });
  } catch {
    onFailure();
  }
}
