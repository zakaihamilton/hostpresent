"use client";

import type { DataConnection, Peer as PeerJS } from "peerjs";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomRole } from "@/lib/room/roomTypes";
import { PARTICIPANT_MODE } from "@/lib/settings/displayNameSettings";
import type { ChatMessage, ParticipantMode } from "@/lib/signaling/messages";
import type {
  AudienceMediaController,
  AudienceMediaState,
} from "@/lib/webrtc/AudienceMediaController";
import type { MediaControlMessage } from "@/lib/webrtc/audienceProtocol";
import { destroyOutboundAudioMixer } from "@/lib/webrtc/outboundMedia";
import { bindRoomConnection } from "./roomDataChannel/bindRoomConnection";
import { startRoomPeerLifecycle } from "./roomDataChannel/peerLifecycle";
import type { RemoteParticipantUpdate } from "./roomDataChannel/types";
import { useRoomConnectionTimers } from "./roomDataChannel/useRoomConnectionTimers";
import { useRoomMessaging } from "./roomDataChannel/useRoomMessaging";
import { useSignalingConfig } from "./roomDataChannel/useSignalingConfig";
import { useTurnRelayDetection } from "./roomDataChannel/useTurnRelayDetection";

export { sendOnConnection } from "./roomDataChannel/sendOnConnection";

const HOST_PRESENT_INTERVAL_MS = 5000;

export function useRoomDataChannel({
  role,
  token,
  peerAuthToken,
  peerId,
  roomId,
  enabled = true,
  displayName = "",
  hostAudioMuted = false,
  hostVideoMuted = false,
  hostMode = "available",
  participantMode = PARTICIPANT_MODE.AVAILABLE,
  localStream = null,
  screenStream = null,
  onRemoteParticipant,
  onRemoteHostStream,
  onChatMessage,
  sessionTitle = "",
}: {
  role?: RoomRole;
  token?: string;
  peerAuthToken?: string;
  peerId?: string;
  roomId?: string | null;
  enabled?: boolean;
  displayName?: string;
  hostAudioMuted?: boolean;
  hostVideoMuted?: boolean;
  hostMode?: ParticipantMode;
  participantMode?: ParticipantMode;
  localStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  onRemoteParticipant?: (participant: RemoteParticipantUpdate) => void;
  onRemoteHostStream?: (stream: MediaStream | null) => void;
  onChatMessage?: (message: ChatMessage) => void;
  sessionTitle?: string;
}) {
  const isHost = role === "host";
  const [isConnected, setIsConnected] = useState(false);
  const [hostPresent, setHostPresent] = useState(isHost);
  const [localParticipantId, setLocalParticipantId] = useState("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  const peerRef = useRef<PeerJS | null>(null);
  const audienceRef = useRef<AudienceMediaController | null>(null);
  const [audienceState, setAudienceState] = useState<
    Partial<AudienceMediaState> & Pick<AudienceMediaState, "canPublish">
  >({ canPublish: isHost });
  const connectionsRef = useRef(new Map<string, DataConnection>());
  const peerDeviceIdsRef = useRef(new Map<string, string>());
  const participantDisplayNamesRef = useRef(new Map<string, string>());
  const hostConnectionRef = useRef<DataConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const openCountRef = useRef(0);
  const signalingOpenRef = useRef(false);
  const localParticipantIdRef = useRef("");
  const teardownPeerRef = useRef<() => void>(() => {});
  const displayNameRef = useRef("");
  const hostAudioMutedRef = useRef(false);
  const hostVideoMutedRef = useRef(false);
  const hostModeRef = useRef<ParticipantMode>("available");
  const participantModeRef = useRef<ParticipantMode>(
    PARTICIPANT_MODE.AVAILABLE,
  );
  const onRemoteParticipantRef = useRef<
    ((participant: RemoteParticipantUpdate) => void) | null
  >(null);
  const onRemoteHostStreamRef = useRef<
    ((stream: MediaStream | null) => void) | null
  >(null);
  const onChatMessageRef = useRef<((message: ChatMessage) => void) | null>(
    null,
  );
  const sessionTitleRef = useRef("");
  const hostDisplayNameRef = useRef("");
  const roomIdRef = useRef<string | null | undefined>(roomId);
  const destroyedRef = useRef(false);

  const { peerConfig, configReady, iceServers, peerConfigRef, iceServersRef } =
    useSignalingConfig({ setConnectionError });

  const {
    hostPresentTimerRef,
    retryTimerRef,
    connectToHostRef,
    retryAttemptRef,
    clearRetryTimer,
    clearConnectRetryTimer,
    clearConnectTimeout,
    clearHostPresentTimer,
    scheduleReconnectToHost,
    scheduleConnectTimeout,
    schedulePeerRetry,
  } = useRoomConnectionTimers({
    isHost,
    destroyedRef,
    audienceRef,
    roomIdRef,
    hostConnectionRef,
    openCountRef,
    signalingOpenRef,
    peerConfigRef,
    onRemoteHostStreamRef,
    setHostPresent,
    setConnectionError,
  });

  const {
    createHostPresencePayload,
    notifyHandlers,
    subscribe,
    send,
    sendToParticipant,
    sendChatMessage,
    sendPrivateChatMessage,
    sendParticipantProfileRef,
  } = useRoomMessaging({
    isHost,
    roomId,
    displayName,
    participantMode,
    roomIdRef,
    localParticipantIdRef,
    connectionsRef,
    hostConnectionRef,
    audienceRef,
    localStreamRef,
    screenStreamRef,
    displayNameRef,
    hostAudioMutedRef,
    hostVideoMutedRef,
    hostModeRef,
    participantModeRef,
    sessionTitleRef,
    onChatMessageRef,
  });

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    displayNameRef.current =
      typeof displayName === "string" ? displayName.trim() : "";
  }, [displayName]);

  useEffect(() => {
    sessionTitleRef.current =
      typeof sessionTitle === "string" ? sessionTitle.trim() : "";
  }, [sessionTitle]);

  useEffect(() => {
    if (!isHost) return;
    hostAudioMutedRef.current = Boolean(hostAudioMuted);
    hostVideoMutedRef.current = Boolean(hostVideoMuted);
  }, [hostAudioMuted, hostVideoMuted, isHost]);

  useEffect(() => {
    if (!isHost) return;
    hostModeRef.current = hostMode === "listening" ? "listening" : "available";
  }, [hostMode, isHost]);

  useEffect(() => {
    if (isHost) return;
    participantModeRef.current =
      participantMode === PARTICIPANT_MODE.LISTENING
        ? PARTICIPANT_MODE.LISTENING
        : PARTICIPANT_MODE.AVAILABLE;
  }, [isHost, participantMode]);

  useEffect(() => {
    onRemoteParticipantRef.current =
      typeof onRemoteParticipant === "function" ? onRemoteParticipant : null;
    onRemoteHostStreamRef.current =
      typeof onRemoteHostStream === "function" ? onRemoteHostStream : null;
  }, [onRemoteParticipant, onRemoteHostStream]);

  useEffect(() => {
    onChatMessageRef.current =
      typeof onChatMessage === "function" ? onChatMessage : null;
  }, [onChatMessage]);

  const updateConnectedState = useCallback(
    (delta: number) => {
      openCountRef.current = Math.max(0, openCountRef.current + delta);
      const connected = openCountRef.current > 0;
      setIsConnected(connected);
      if (connected) {
        setConnectionError(null);
        retryAttemptRef.current = 0;
      }
    },
    [retryAttemptRef],
  );

  const disconnect = useCallback(() => {
    clearRetryTimer();
    clearConnectRetryTimer();
    clearConnectTimeout();
    clearHostPresentTimer();
    teardownPeerRef.current();
    retryAttemptRef.current = 0;
    setConnectionError(null);
    setIsConnected(false);
    setHostPresent(isHost);
    setLocalParticipantId("");
  }, [
    clearConnectRetryTimer,
    clearConnectTimeout,
    clearHostPresentTimer,
    clearRetryTimer,
    isHost,
    retryAttemptRef,
  ]);

  const reconnect = useCallback(() => {
    retryAttemptRef.current = 0;
    setConnectionError(null);
    setIsConnected(false);
    setHostPresent(isHost);
    setReconnectTrigger((prev) => prev + 1);
  }, [isHost, retryAttemptRef]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
    if (!enabled || !isHost || !token) return;

    // Do not make viewers wait for the periodic host-presence announcement to
    // learn that the host has started or stopped sharing.
    send(createHostPresencePayload());
  }, [createHostPresencePayload, enabled, isHost, screenStream, send, token]);

  const enqueueSync = useCallback(
    (
      overrides: {
        localStream?: MediaStream | null;
        screenStream?: MediaStream | null;
      } = {},
    ) => {
      if (Object.hasOwn(overrides, "localStream"))
        localStreamRef.current = overrides.localStream;
      if (Object.hasOwn(overrides, "screenStream"))
        screenStreamRef.current = overrides.screenStream;
      return audienceRef.current?.sync() ?? Promise.resolve();
    },
    [],
  );

  const onMediaOpen = useCallback(
    (id: string) => audienceRef.current?.connectionOpen(id),
    [],
  );
  const onMediaClose = useCallback(
    (id: string) => audienceRef.current?.connectionClose(id),
    [],
  );
  const onMediaControl = useCallback(
    (id: string, message: MediaControlMessage) =>
      audienceRef.current?.handleControl(id, message),
    [],
  );

  const bindConnection = useCallback(
    (
      conn: DataConnection,
      {
        remoteId,
        remoteName = "Guest",
      }: { remoteId?: string; remoteName?: string },
    ) => {
      bindRoomConnection(
        conn,
        { remoteId, remoteName },
        {
          isHost,
          isCurrentConnection: () =>
            isHost
              ? connectionsRef.current.get(remoteId) === conn
              : hostConnectionRef.current === conn,
          destroyedRef,
          updateConnectedState,
          createHostPresencePayload,
          onRemoteParticipantRef,
          onMediaOpen,
          onMediaClose,
          onMediaControl,
          sendParticipantProfileRef,
          scheduleReconnectToHost,
          roomIdRef,
          participantDisplayNamesRef,
          hostDisplayNameRef,
          localParticipantIdRef,
          connectionsRef,
          notifyHandlers,
          onChatMessageRef,
          peerDeviceIdsRef,
          setHostPresent,
          setConnectionError,
        },
      );
    },
    [
      createHostPresencePayload,
      isHost,
      notifyHandlers,
      onMediaClose,
      onMediaControl,
      onMediaOpen,
      scheduleReconnectToHost,
      sendParticipantProfileRef,
      updateConnectedState,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: The manual reconnect counter intentionally restarts this lifecycle even when transport settings are unchanged.
  useEffect(() => {
    if (
      !configReady ||
      !peerConfig ||
      !iceServers ||
      !peerAuthToken ||
      !peerId
    ) {
      return undefined;
    }

    if (!enabled || !token || !roomId || typeof window === "undefined") {
      return undefined;
    }

    destroyedRef.current = false;

    const teardownPeer = () => {
      audienceRef.current?.dispose();
      audienceRef.current = null;
      peerDeviceIdsRef.current.clear();
      participantDisplayNamesRef.current.clear();
      hostDisplayNameRef.current = "";

      try {
        for (const conn of connectionsRef.current.values()) {
          conn.close();
        }
      } catch (e) {
        console.warn("[peer] error closing connections", e);
      }
      connectionsRef.current.clear();

      try {
        hostConnectionRef.current?.close();
      } catch (e) {
        console.warn("[peer] error closing host connection", e);
      }
      hostConnectionRef.current = null;

      try {
        peerRef.current?.destroy();
      } catch (e) {
        console.warn("[peer] error destroying peer", e);
      }
      peerRef.current = null;

      openCountRef.current = 0;
      signalingOpenRef.current = false;
      localParticipantIdRef.current = "";

      try {
        destroyOutboundAudioMixer();
      } catch (e) {
        console.warn("[peer] error destroying audio mixer", e);
      }
    };
    teardownPeerRef.current = teardownPeer;

    startRoomPeerLifecycle({
      isHost,
      roomId,
      peerId,
      peerAuthToken,
      peerConfig,
      iceServers,
      peerConfigRef,
      iceServersRef,
      peerRef,
      audienceRef,
      connectionsRef,
      hostConnectionRef,
      peerDeviceIdsRef,
      participantDisplayNamesRef,
      destroyedRef,
      localParticipantIdRef,
      localStreamRef,
      screenStreamRef,
      onRemoteParticipantRef,
      onRemoteHostStreamRef,
      hostDisplayNameRef,
      signalingOpenRef,
      retryAttemptRef,
      retryTimerRef,
      connectToHostRef,
      setAudienceState,
      setLocalParticipantId,
      setConnectionError,
      teardownPeer,
      bindConnection,
      clearConnectTimeout,
      clearRetryTimer,
      scheduleConnectTimeout,
      schedulePeerRetry,
      scheduleReconnectToHost,
    });

    return () => {
      destroyedRef.current = true;
      clearRetryTimer();
      clearConnectRetryTimer();
      clearConnectTimeout();
      clearHostPresentTimer();
      teardownPeerRef.current();
    };
  }, [
    bindConnection,
    clearConnectRetryTimer,
    clearConnectTimeout,
    clearHostPresentTimer,
    clearRetryTimer,
    configReady,
    enabled,
    iceServers,
    isHost,
    peerConfig,
    peerAuthToken,
    peerId,
    reconnectTrigger,
    roomId,
    scheduleConnectTimeout,
    schedulePeerRetry,
    scheduleReconnectToHost,
    token,
  ]);

  useEffect(() => {
    if (enabled) return undefined;
    disconnect();
    return undefined;
  }, [disconnect, enabled]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const handlePageHide = () => {
      disconnect();
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [disconnect, enabled]);

  useEffect(() => {
    if (!enabled || !isHost || !token) return undefined;

    const announce = () => send(createHostPresencePayload());
    announce();
    hostPresentTimerRef.current = window.setInterval(
      announce,
      HOST_PRESENT_INTERVAL_MS,
    );

    return () => {
      clearHostPresentTimer();
    };
  }, [
    clearHostPresentTimer,
    createHostPresencePayload,
    enabled,
    hostPresentTimerRef,
    isHost,
    send,
    token,
  ]);

  const isTurnActive = useTurnRelayDetection({
    isConnected,
    connectionsRef,
    audienceRef,
  });

  const visibleConnectionError = isConnected ? null : connectionError;

  const status =
    connectionError && !isConnected
      ? "error"
      : (isHost ? Boolean(localParticipantId) : isConnected)
        ? "connected"
        : "connecting";

  return {
    send,
    sendToParticipant,
    sendChatMessage,
    sendPrivateChatMessage,
    subscribe,
    disconnect,
    syncOutboundMedia: enqueueSync,
    ...audienceState,
    requestPublishing: (request) =>
      audienceRef.current?.requestPublishing(request),
    approvePublishing: (id) => audienceRef.current?.approve(id),
    revokePublishing: (id) => audienceRef.current?.revoke(id),
    isConnected,
    hostPresent,
    localParticipantId,
    connectionError: visibleConnectionError,
    signalingConfigured: Boolean(peerConfig),
    status,
    peerConfig,
    iceServers: iceServersRef.current,
    activeConnectionsCount: isHost
      ? connectionsRef.current.size
      : hostConnectionRef.current?.open
        ? 1
        : 0,
    reconnect,
    isTurnActive,
    getParticipantDeviceId: (peerId) =>
      peerDeviceIdsRef.current.get(peerId) ?? "",
  };
}
