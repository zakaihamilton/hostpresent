"use client";

import type { DataConnection, Peer as PeerJS } from "peerjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIceServers } from "@/components/webrtc/PeerStreamConnection";
import {
  canSendSignalingMessage,
  isParticipantStatusMessage,
} from "@/lib/room/messageAuth";
import type { PeerJsConfig, RoomRole } from "@/lib/room/roomTypes";
import { PARTICIPANT_MODE } from "@/lib/settings/displayNameSettings";
import { getOrCreateParticipantDeviceId } from "@/lib/settings/participantDeviceId";
import type {
  ChatMessage,
  ParticipantMode,
  SignalingMessage,
} from "@/lib/signaling/messages";
import {
  createChatMessage,
  createChatPrivateMessage,
  createHostPresentMessage,
  createParticipantProfileMessage,
  isSignalingMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import type {
  AudienceMediaController,
  AudienceMediaState,
} from "@/lib/webrtc/AudienceMediaController";
import type { MediaControlMessage } from "@/lib/webrtc/audienceProtocol";
import { destroyOutboundAudioMixer } from "@/lib/webrtc/outboundMedia";
import {
  connectionRetryDelayMs,
  hostPeerId,
  hostSignalingRetryExhaustedError,
  hostSignalingTimeoutError,
  isWaitingForHostMessage,
  MAX_SIGNALING_RETRIES,
  participantSignalingRetryExhaustedError,
  participantSignalingTimeoutError,
  peerErrorMessage,
  SIGNALING_CONNECT_TIMEOUT_MS,
  SIGNALING_ERROR,
} from "@/lib/webrtc/peerClient";
import { clearWindowTimer } from "@/lib/webrtc/roomConnectionLifecycle";
import { fetchPeerJsConfig } from "@/lib/webrtc/signalingConfig";
import { bindRoomConnection } from "./roomDataChannel/bindRoomConnection";
import { startRoomPeerLifecycle } from "./roomDataChannel/peerLifecycle";
import { sendOnConnection } from "./roomDataChannel/sendOnConnection";
import type {
  RemoteParticipantUpdate,
  RoomMessageHandler,
  SendParticipantProfileOptions,
} from "./roomDataChannel/types";

export { sendOnConnection } from "./roomDataChannel/sendOnConnection";

const SIGNALING_NOT_CONFIGURED_ERROR = SIGNALING_ERROR.NOT_CONFIGURED;

const HOST_PRESENT_INTERVAL_MS = 5000;
const CONNECT_RETRY_MS = 2000;

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
  const [peerConfig, setPeerConfig] = useState<PeerJsConfig | null>(null);
  const [configReady, setConfigReady] = useState(false);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const iceServers = useIceServers();

  const peerRef = useRef<PeerJS | null>(null);
  const audienceRef = useRef<AudienceMediaController | null>(null);
  const [audienceState, setAudienceState] = useState<
    Partial<AudienceMediaState> & Pick<AudienceMediaState, "canPublish">
  >({ canPublish: isHost });
  const peerConfigRef = useRef<PeerJsConfig | null>(null);
  const iceServersRef = useRef<RTCIceServer[] | null>(null);
  const connectionsRef = useRef(new Map<string, DataConnection>());
  const peerDeviceIdsRef = useRef(new Map<string, string>());
  const participantDisplayNamesRef = useRef(new Map<string, string>());
  const hostConnectionRef = useRef<DataConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const handlersRef = useRef(new Set<RoomMessageHandler>());
  const hostPresentTimerRef = useRef<number | null>(null);
  const openCountRef = useRef(0);
  const signalingOpenRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const connectRetryTimerRef = useRef<number | null>(null);
  const connectToHostRef = useRef<() => void>(() => {});
  const connectTimeoutRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);
  const localParticipantIdRef = useRef("");
  const teardownPeerRef = useRef<() => void>(() => {});
  const displayNameRef = useRef("");
  const hostAudioMutedRef = useRef(false);
  const hostVideoMutedRef = useRef(false);
  const hostModeRef = useRef<ParticipantMode>("available");
  const participantModeRef = useRef<ParticipantMode>(
    PARTICIPANT_MODE.AVAILABLE,
  );
  const sendParticipantProfileRef = useRef<
    (options?: SendParticipantProfileOptions) => boolean
  >(() => false);
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

  const createHostPresencePayload = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    return createHostPresentMessage({
      displayName: displayNameRef.current,
      audioMuted: audioTrack ? !audioTrack.enabled : hostAudioMutedRef.current,
      videoMuted: videoTrack ? !videoTrack.enabled : hostVideoMutedRef.current,
      mode: hostModeRef.current,
      sessionTitle: sessionTitleRef.current,
      screenSharing: Boolean(screenStreamRef.current),
    });
  }, []);

  const updateConnectedState = useCallback((delta: number) => {
    openCountRef.current = Math.max(0, openCountRef.current + delta);
    const connected = openCountRef.current > 0;
    setIsConnected(connected);
    if (connected) {
      setConnectionError(null);
      retryAttemptRef.current = 0;
    }
  }, []);

  const notifyHandlers = useCallback(
    (message: SignalingMessage | ChatMessage) => {
      for (const handler of handlersRef.current) {
        handler(message);
      }
    },
    [],
  );

  const subscribe = useCallback((handler: RoomMessageHandler) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  const clearRetryTimer = useCallback(() => {
    clearWindowTimer(retryTimerRef);
  }, []);

  const clearConnectRetryTimer = useCallback(() => {
    clearWindowTimer(connectRetryTimerRef);
  }, []);

  const scheduleReconnectToHost = useCallback(() => {
    if (isHost || destroyedRef.current) return;

    clearConnectRetryTimer();
    audienceRef.current?.connectionClose(hostPeerId(roomIdRef.current));
    hostConnectionRef.current?.close();
    hostConnectionRef.current = null;
    setHostPresent(false);
    onRemoteHostStreamRef.current?.(null);

    if (openCountRef.current <= 0) {
      setConnectionError((previous) => {
        if (isWaitingForHostMessage(previous)) return previous;
        return peerErrorMessage(
          { type: "peer-unavailable" },
          { isHost: false },
        );
      });
    }

    connectRetryTimerRef.current = window.setTimeout(() => {
      if (destroyedRef.current) return;
      connectToHostRef.current();
    }, CONNECT_RETRY_MS);
  }, [clearConnectRetryTimer, isHost]);

  const clearConnectTimeout = useCallback(() => {
    clearWindowTimer(connectTimeoutRef);
  }, []);

  const scheduleConnectTimeout = useCallback(() => {
    if (typeof window === "undefined") return;

    clearConnectTimeout();
    const timeoutMs = isHost ? 10000 : SIGNALING_CONNECT_TIMEOUT_MS;
    connectTimeoutRef.current = window.setTimeout(() => {
      if (destroyedRef.current) return;
      if (signalingOpenRef.current) {
        if (isHost) return;
        setConnectionError((previous) => {
          if (isWaitingForHostMessage(previous)) return previous;
          if (openCountRef.current > 0) return null;
          return previous ?? "[E011] Waiting for the host to join\u2026";
        });
        return;
      }

      if (openCountRef.current > 0) return;
      if (retryTimerRef.current || connectRetryTimerRef.current) return;

      setConnectionError((previous) => {
        if (isWaitingForHostMessage(previous)) return previous;
        return isHost
          ? hostSignalingTimeoutError()
          : participantSignalingTimeoutError();
      });
    }, timeoutMs);
  }, [clearConnectTimeout, isHost]);

  const disconnect = useCallback(() => {
    clearRetryTimer();
    clearConnectRetryTimer();
    clearConnectTimeout();
    if (hostPresentTimerRef.current) {
      clearInterval(hostPresentTimerRef.current);
      hostPresentTimerRef.current = null;
    }
    teardownPeerRef.current();
    retryAttemptRef.current = 0;
    setConnectionError(null);
    setIsConnected(false);
    setHostPresent(isHost);
    setLocalParticipantId("");
  }, [clearConnectRetryTimer, clearConnectTimeout, clearRetryTimer, isHost]);

  const reconnect = useCallback(() => {
    retryAttemptRef.current = 0;
    setConnectionError(null);
    setIsConnected(false);
    setHostPresent(isHost);
    setReconnectTrigger((prev) => prev + 1);
  }, [isHost]);

  const send = useCallback(
    (message: unknown) => {
      if (!isSignalingMessage(message)) return false;

      let outboundMessage = message;
      if (!isHost && isParticipantStatusMessage(message)) {
        const participantId = localParticipantIdRef.current;
        if (!participantId) return false;
        outboundMessage = { ...message, participantId };
      }

      if (
        !canSendSignalingMessage({
          isHost,
          message: outboundMessage,
          localParticipantId: localParticipantIdRef.current,
        })
      ) {
        return false;
      }

      if (isHost) {
        if (message.type === SIGNALING_MESSAGE.HOST_FOCUS_CHANGED)
          audienceRef.current?.focus(
            message.focusedId === "host"
              ? hostPeerId(roomIdRef.current)
              : message.focusedId,
          );
        const targetId = message.participantId;
        if (
          targetId &&
          (message.type === SIGNALING_MESSAGE.HOST_MUTE_AUDIO ||
            message.type === SIGNALING_MESSAGE.HOST_MUTE_VIDEO)
        ) {
          const conn = connectionsRef.current.get(targetId);
          return sendOnConnection(conn, outboundMessage);
        }

        let sent = false;
        for (const conn of connectionsRef.current.values()) {
          if (sendOnConnection(conn, outboundMessage)) sent = true;
        }
        return sent;
      }

      return sendOnConnection(hostConnectionRef.current, outboundMessage);
    },
    [isHost],
  );

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
      scheduleReconnectToHost,
      onMediaOpen,
      onMediaClose,
      onMediaControl,
      updateConnectedState,
    ],
  );

  const sendParticipantProfile = useCallback(
    ({
      nextDisplayName,
      nextParticipantMode,
    }: SendParticipantProfileOptions = {}) => {
      if (isHost) return false;

      const participantId = localParticipantIdRef.current;
      if (!participantId || !hostConnectionRef.current?.open) {
        return false;
      }

      return sendOnConnection(
        hostConnectionRef.current,
        createParticipantProfileMessage({
          participantId,
          displayName:
            nextDisplayName === undefined
              ? displayNameRef.current
              : nextDisplayName,
          mode:
            nextParticipantMode === undefined
              ? participantModeRef.current
              : nextParticipantMode,
          deviceId: getOrCreateParticipantDeviceId(),
        }),
      );
    },
    [isHost],
  );

  useEffect(() => {
    sendParticipantProfileRef.current = sendParticipantProfile;
  }, [sendParticipantProfile]);

  useEffect(() => {
    if (isHost) return undefined;
    sendParticipantProfile({
      nextDisplayName: displayName,
      nextParticipantMode: participantMode,
    });
  }, [displayName, isHost, participantMode, sendParticipantProfile]);

  const sendToParticipant = useCallback(
    (participantId: string, message: unknown) => {
      if (!isHost || !participantId || !isSignalingMessage(message)) {
        return false;
      }
      if (
        !canSendSignalingMessage({
          isHost,
          message,
          localParticipantId: localParticipantIdRef.current,
        })
      ) {
        return false;
      }

      const conn = connectionsRef.current.get(participantId);
      return sendOnConnection(conn, message);
    },
    [isHost],
  );

  const deliverChatMessage = useCallback(
    (message: ChatMessage, recipientId?: string) => {
      if (isHost) {
        let sent = false;
        if (recipientId) {
          sent = sendOnConnection(
            connectionsRef.current.get(recipientId),
            message,
          );
        } else {
          for (const conn of connectionsRef.current.values()) {
            if (sendOnConnection(conn, message)) sent = true;
          }
        }
        notifyHandlers(message);
        onChatMessageRef.current?.(message);
        return sent;
      }

      const sent = sendOnConnection(hostConnectionRef.current, message);
      if (sent) onChatMessageRef.current?.(message);
      return sent;
    },
    [isHost, notifyHandlers],
  );

  const sendChatMessage = useCallback(
    (text: string) => {
      const senderId = isHost
        ? hostPeerId(roomId)
        : localParticipantIdRef.current;
      const message = createChatMessage({
        senderId,
        senderName: displayNameRef.current,
        text,
      });
      if (!message.text) return false;
      return deliverChatMessage(message);
    },
    [deliverChatMessage, isHost, roomId],
  );

  const sendPrivateChatMessage = useCallback(
    (text: string, recipientId: string) => {
      const senderId = isHost
        ? hostPeerId(roomId)
        : localParticipantIdRef.current;
      const message = createChatPrivateMessage({
        senderId,
        senderName: displayNameRef.current,
        recipientId,
        text,
      });
      if (!message.text || !recipientId) return false;
      return deliverChatMessage(message, recipientId);
    },
    [deliverChatMessage, isHost, roomId],
  );

  const schedulePeerRetry = useCallback(
    (restart: () => void) => {
      if (!peerConfigRef.current) return;

      if (retryAttemptRef.current >= MAX_SIGNALING_RETRIES) {
        setConnectionError(
          isHost
            ? hostSignalingRetryExhaustedError()
            : participantSignalingRetryExhaustedError(),
        );
        return;
      }

      clearRetryTimer();
      const delay = connectionRetryDelayMs(retryAttemptRef.current);
      retryAttemptRef.current += 1;
      retryTimerRef.current = window.setTimeout(() => {
        restart();
      }, delay);
      scheduleConnectTimeout();
    },
    [clearRetryTimer, isHost, scheduleConnectTimeout],
  );

  useEffect(() => {
    let cancelled = false;
    setConfigReady(false);
    setPeerConfig(null);
    peerConfigRef.current = null;

    void fetchPeerJsConfig()
      .then((config) => {
        if (cancelled) return;
        if (!config) {
          setConnectionError(SIGNALING_NOT_CONFIGURED_ERROR);
          setConfigReady(true);
          return;
        }
        setConnectionError(null);
        setPeerConfig(config);
        peerConfigRef.current = config;
        setConfigReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[peer] failed to load signaling config", err);
        setConnectionError(SIGNALING_ERROR.CONFIG_LOAD_FAILED);
        setConfigReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    iceServersRef.current = iceServers;
  }, [iceServers]);

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
      if (hostPresentTimerRef.current) {
        clearInterval(hostPresentTimerRef.current);
        hostPresentTimerRef.current = null;
      }
      teardownPeerRef.current();
    };
  }, [
    bindConnection,
    clearConnectRetryTimer,
    clearConnectTimeout,
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
      if (hostPresentTimerRef.current) {
        clearInterval(hostPresentTimerRef.current);
      }
    };
  }, [createHostPresencePayload, enabled, isHost, send, token]);

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
  }, [isConnected]);

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
