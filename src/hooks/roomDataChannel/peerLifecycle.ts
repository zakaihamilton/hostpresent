import type { DataConnection, Peer as PeerJS } from "peerjs";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { MAX_PARTICIPANT_CONNECTIONS } from "@/lib/room/peerLimits";
import type { PeerJsConfig } from "@/lib/room/roomTypes";
import { createRoomFullMessage } from "@/lib/signaling/messages";
import { AudienceMediaController } from "@/lib/webrtc/AudienceMediaController";
import { buildOutboundMediaStream } from "@/lib/webrtc/outboundMedia";
import {
  hostIdRetryDelayMs,
  hostPeerId,
  hostSignalingRetryExhaustedError,
  isRetryablePeerError,
  loadPeer,
  MAX_HOST_ID_RETRIES,
  peerErrorMessage,
  SIGNALING_ERROR,
} from "@/lib/webrtc/peerClient";
import { sendOnConnection } from "./sendOnConnection";
import type { RemoteParticipantUpdate } from "./types";

type PeerConstructor = typeof import("peerjs").Peer;
const HOST_CONNECTION_OPEN_TIMEOUT_MS = 15_000;

interface RoomPeerLifecycleContext {
  isHost: boolean;
  roomId: string;
  peerId: string;
  peerAuthToken: string;
  peerConfig: PeerJsConfig;
  iceServers: RTCIceServer[];
  peerConfigRef: MutableRefObject<PeerJsConfig | null>;
  iceServersRef: MutableRefObject<RTCIceServer[] | null>;
  peerRef: MutableRefObject<PeerJS | null>;
  audienceRef: MutableRefObject<AudienceMediaController | null>;
  connectionsRef: MutableRefObject<Map<string, DataConnection>>;
  hostConnectionRef: MutableRefObject<DataConnection | null>;
  peerDeviceIdsRef: MutableRefObject<Map<string, string>>;
  participantDisplayNamesRef: MutableRefObject<Map<string, string>>;
  destroyedRef: MutableRefObject<boolean>;
  localParticipantIdRef: MutableRefObject<string>;
  localStreamRef: MutableRefObject<MediaStream | null>;
  screenStreamRef: MutableRefObject<MediaStream | null>;
  onRemoteParticipantRef: MutableRefObject<
    ((participant: RemoteParticipantUpdate) => void) | null
  >;
  onRemoteHostStreamRef: MutableRefObject<
    ((stream: MediaStream | null) => void) | null
  >;
  hostDisplayNameRef: MutableRefObject<string>;
  signalingOpenRef: MutableRefObject<boolean>;
  retryAttemptRef: MutableRefObject<number>;
  retryTimerRef: MutableRefObject<number | null>;
  connectToHostRef: MutableRefObject<() => void>;
  setAudienceState: Dispatch<
    SetStateAction<
      Partial<
        import("@/lib/webrtc/AudienceMediaController").AudienceMediaState
      > &
        Pick<
          import("@/lib/webrtc/AudienceMediaController").AudienceMediaState,
          "canPublish"
        >
    >
  >;
  setLocalParticipantId: Dispatch<SetStateAction<string>>;
  setConnectionError: Dispatch<SetStateAction<string | null>>;
  teardownPeer: () => void;
  bindConnection: (
    connection: DataConnection,
    metadata: { remoteId?: string; remoteName?: string },
  ) => void;
  clearConnectTimeout: () => void;
  clearRetryTimer: () => void;
  scheduleConnectTimeout: () => void;
  schedulePeerRetry: (restart: () => void) => void;
  scheduleReconnectToHost: () => void;
}

function createPeer(
  context: RoomPeerLifecycleContext,
  Peer: PeerConstructor,
  id: string,
): PeerJS | null {
  if (context.destroyedRef.current) return null;

  context.teardownPeer();
  context.scheduleConnectTimeout();
  const baseOptions = context.peerConfigRef.current ?? context.peerConfig;
  const options = {
    ...baseOptions,
    token: context.peerAuthToken,
    config: { iceServers: context.iceServersRef.current ?? context.iceServers },
  };
  const peer = new Peer(id, options);
  context.peerRef.current = peer;
  context.audienceRef.current = new AudienceMediaController({
    isHost: context.isHost,
    localId: id,
    hostId: hostPeerId(context.roomId),
    getPeer: () => context.peerRef.current,
    getLocalStream: () =>
      buildOutboundMediaStream(
        context.localStreamRef.current,
        context.screenStreamRef.current,
      ),
    sendControl: (target, message) =>
      sendOnConnection(
        context.isHost
          ? context.connectionsRef.current.get(target)
          : context.hostConnectionRef.current,
        message,
      ),
    onStream: (sourceId, stream) => {
      if (!context.isHost && sourceId === hostPeerId(context.roomId)) {
        context.onRemoteHostStreamRef.current?.(stream);
      } else {
        context.onRemoteParticipantRef.current?.({
          id: sourceId,
          stream,
          preserveProfile: true,
        });
      }
    },
    onState: context.setAudienceState,
    rejectPeer: (target) =>
      window.setTimeout(
        () => context.connectionsRef.current.get(target)?.close(),
        500,
      ),
  });
  return peer;
}

function startHostPeer(
  context: RoomPeerLifecycleContext,
  Peer: PeerConstructor,
) {
  const peer = createPeer(context, Peer, hostPeerId(context.roomId));
  if (!peer) return;

  peer.on("open", () => {
    if (context.destroyedRef.current || peer !== context.peerRef.current)
      return;
    context.signalingOpenRef.current = true;
    context.setLocalParticipantId(hostPeerId(context.roomId));
    context.clearConnectTimeout();
    context.setConnectionError(null);
    context.retryAttemptRef.current = 0;
    void context.audienceRef.current?.sync();
  });

  peer.on("disconnected", () => {
    if (
      context.destroyedRef.current ||
      peer.destroyed ||
      peer !== context.peerRef.current
    ) {
      return;
    }
    console.warn(
      "[peer] host disconnected from signaling server, reconnecting...",
    );
    context.audienceRef.current?.restartEpoch();
    peer.reconnect();
  });

  peer.on("connection", (conn) => {
    if (context.destroyedRef.current || peer !== context.peerRef.current)
      return;
    const remoteId = conn.peer;

    if (context.connectionsRef.current.has(remoteId)) {
      conn.close();
      return;
    }

    if (context.connectionsRef.current.size >= MAX_PARTICIPANT_CONNECTIONS) {
      const rejectConnection = () => {
        try {
          conn.send(JSON.stringify(createRoomFullMessage()));
        } catch (error) {
          console.warn("[peer] failed to send room_full signal", error);
        }
        window.setTimeout(() => conn.close(), 500);
      };

      if (conn.open) rejectConnection();
      else conn.on("open", rejectConnection);
      return;
    }

    context.connectionsRef.current.set(remoteId, conn);
    const releasePendingConnection = () => {
      if (conn.open || context.connectionsRef.current.get(remoteId) !== conn) {
        return;
      }
      window.clearTimeout(openTimeout);
      context.connectionsRef.current.delete(remoteId);
      context.peerDeviceIdsRef.current.delete(remoteId);
      context.participantDisplayNamesRef.current.delete(remoteId);
      conn.close();
    };
    const openTimeout = window.setTimeout(
      releasePendingConnection,
      HOST_CONNECTION_OPEN_TIMEOUT_MS,
    );
    conn.on("open", () => window.clearTimeout(openTimeout));
    conn.on("close", () => window.clearTimeout(openTimeout));
    conn.on("error", releasePendingConnection);
    context.bindConnection(conn, { remoteId, remoteName: "Guest" });
    conn.on("close", () => {
      if (context.connectionsRef.current.get(remoteId) !== conn) return;
      context.connectionsRef.current.delete(remoteId);
      context.peerDeviceIdsRef.current.delete(remoteId);
      context.participantDisplayNamesRef.current.delete(remoteId);
    });
  });

  peer.on("call", (call) => {
    if (context.destroyedRef.current || peer !== context.peerRef.current)
      return;
    context.audienceRef.current?.handleCall(call);
  });

  peer.on("error", (error) => {
    if (context.destroyedRef.current || peer !== context.peerRef.current)
      return;
    console.warn("[peer] host error", error);

    if (error.type === "unavailable-id") {
      context.setConnectionError(SIGNALING_ERROR.HOST_ID_RECONNECTING);
      context.clearRetryTimer();
      if (context.retryAttemptRef.current >= MAX_HOST_ID_RETRIES) {
        context.setConnectionError(hostSignalingRetryExhaustedError());
        return;
      }
      const delay = hostIdRetryDelayMs(context.retryAttemptRef.current);
      context.retryAttemptRef.current += 1;
      context.retryTimerRef.current = window.setTimeout(() => {
        startHostPeer(context, Peer);
      }, delay);
      context.scheduleConnectTimeout();
      return;
    }

    if (isRetryablePeerError(error)) {
      context.setConnectionError(peerErrorMessage(error, { isHost: true }));
      context.schedulePeerRetry(() => startHostPeer(context, Peer));
      return;
    }

    context.setConnectionError(peerErrorMessage(error, { isHost: true }));
  });
}

function startParticipantPeer(
  context: RoomPeerLifecycleContext,
  Peer: PeerConstructor,
) {
  const peer = createPeer(context, Peer, context.peerId);
  if (!peer) return;

  const connectToHost = () => {
    if (
      context.destroyedRef.current ||
      !context.peerRef.current ||
      context.hostConnectionRef.current?.open
    ) {
      return;
    }

    context.hostConnectionRef.current?.close();
    context.hostConnectionRef.current = null;

    const conn = peer.connect(hostPeerId(context.roomId));
    context.hostConnectionRef.current = conn;
    context.bindConnection(conn, {
      remoteId: peer.id ?? "guest",
      remoteName: "Guest",
    });

    conn.on("error", (error) => {
      if (context.destroyedRef.current) return;
      context.setConnectionError(peerErrorMessage(error, { isHost: false }));
      context.scheduleReconnectToHost();
    });
  };
  context.connectToHostRef.current = connectToHost;

  peer.on("call", (call) => {
    if (context.destroyedRef.current || peer !== context.peerRef.current)
      return;
    context.audienceRef.current?.handleCall(call);
  });

  peer.on("open", (id) => {
    if (context.destroyedRef.current || peer !== context.peerRef.current)
      return;
    context.signalingOpenRef.current = true;
    context.clearConnectTimeout();
    context.localParticipantIdRef.current = id;
    context.setLocalParticipantId(id);
    context.setConnectionError(null);
    context.retryAttemptRef.current = 0;
    connectToHost();
  });

  peer.on("disconnected", () => {
    if (
      context.destroyedRef.current ||
      peer.destroyed ||
      peer !== context.peerRef.current
    ) {
      return;
    }
    console.warn(
      "[peer] participant disconnected from signaling server, reconnecting...",
    );
    peer.reconnect();
  });

  peer.on("error", (error) => {
    if (context.destroyedRef.current || peer !== context.peerRef.current)
      return;

    if (error.type === "peer-unavailable") {
      context.setConnectionError(peerErrorMessage(error, { isHost: false }));
      context.scheduleReconnectToHost();
      return;
    }

    console.warn("[peer] participant error", error);
    if (isRetryablePeerError(error)) {
      context.setConnectionError(peerErrorMessage(error, { isHost: false }));
      context.schedulePeerRetry(() => startParticipantPeer(context, Peer));
      return;
    }

    context.setConnectionError(peerErrorMessage(error, { isHost: false }));
  });
}

export function startRoomPeerLifecycle(context: RoomPeerLifecycleContext) {
  void loadPeer().then((Peer) => {
    if (context.destroyedRef.current) return;
    if (context.isHost) startHostPeer(context, Peer);
    else startParticipantPeer(context, Peer);
  });
}
