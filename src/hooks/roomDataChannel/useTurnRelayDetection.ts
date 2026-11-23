import type { DataConnection } from "peerjs";
import { type MutableRefObject, useEffect, useState } from "react";
import type { AudienceMediaController } from "@/lib/webrtc/AudienceMediaController";

async function hasRelayCandidate(
  peerConnections: Array<RTCPeerConnection | null | undefined>,
): Promise<boolean> {
  for (const peerConnection of peerConnections) {
    if (!peerConnection) continue;
    try {
      const stats = await peerConnection.getStats();
      for (const report of stats.values()) {
        if (report.type !== "candidate-pair" || report.state !== "succeeded") {
          continue;
        }
        const localCandidate = stats.get(report.localCandidateId);
        if (localCandidate?.candidateType === "relay") return true;
      }
    } catch {
      // Ignore individual peer stats errors and inspect the remaining peers.
    }
  }
  return false;
}

export function useTurnRelayDetection({
  isConnected,
  connectionsRef,
  audienceRef,
}: {
  isConnected: boolean;
  connectionsRef: MutableRefObject<Map<string, DataConnection>>;
  audienceRef: MutableRefObject<AudienceMediaController | null>;
}): boolean {
  const [isTurnActive, setIsTurnActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !isConnected) {
      setIsTurnActive(false);
      return undefined;
    }

    const interval = setInterval(async () => {
      const peerConnections = [
        ...Array.from(
          connectionsRef.current.values(),
          (conn) => conn.peerConnection,
        ),
        ...[
          ...(audienceRef.current?.incoming.values() ?? []),
          ...(audienceRef.current?.outgoing.values() ?? []),
        ].map((record) => record.call.peerConnection),
      ];
      setIsTurnActive(await hasRelayCandidate(peerConnections));
    }, 3000);

    return () => clearInterval(interval);
  }, [audienceRef, connectionsRef, isConnected]);

  return isTurnActive;
}
