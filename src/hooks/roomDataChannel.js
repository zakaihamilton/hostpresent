"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIceServers } from "@/components/webrtc/PeerStreamConnection";
import {
  canSendSignalingMessage,
  isParticipantStatusMessage,
} from "@/lib/room/messageAuth";
import { MAX_PARTICIPANT_CONNECTIONS } from "@/lib/room/peerLimits.mjs";
import { PARTICIPANT_MODE } from "@/lib/settings/displayNameSettings";
import { getOrCreateParticipantDeviceId } from "@/lib/settings/participantDeviceId";
import {
  createChatMessage,
  createChatPrivateMessage,
  createHostPresentMessage,
  createParticipantProfileMessage,
  createRoomFullMessage,
  isSignalingMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import { AudienceMediaController } from "@/lib/webrtc/AudienceMediaController";
import {
  buildOutboundMediaStream,
  destroyOutboundAudioMixer,
} from "@/lib/webrtc/outboundMedia";
import {
  connectionRetryDelayMs,
  hostIdRetryDelayMs,
  hostPeerId,
  hostSignalingRetryExhaustedError,
  hostSignalingTimeoutError,
  isRetryablePeerError,
  isWaitingForHostMessage,
  loadPeer,
  MAX_HOST_ID_RETRIES,
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
import { sendOnConnection } from "./roomDataChannel/sendOnConnection";

export { sendOnConnection } from "./roomDataChannel/sendOnConnection";

const SIGNALING_NOT_CONFIGURED_ERROR = SIGNALING_ERROR.NOT_CONFIGURED;

const HOST_PRESENT_INTERVAL_MS = 5000;
const CONNECT_RETRY_MS = 2000;

async function hasRelayCandidate(peerConnections) {
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
}) {
  const isHost = role === "host";
  const [isConnected, setIsConnected] = useState(false);
  const [hostPresent, setHostPresent] = useState(isHost);
  const [localParticipantId, setLocalParticipantId] = useState("");
  const [connectionError, setConnectionError] = useState(null);
  const [peerConfig, setPeerConfig] = useState(null);
  const [configReady, setConfigReady] = useState(false);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const iceServers = useIceServers();

  const peerRef = useRef(null);
  const audienceRef = useRef(null);
  const [audienceState, setAudienceState] = useState({ canPublish: isHost });
  const peerConfigRef = useRef(null);
  const iceServersRef = useRef(null);
  const connectionsRef = useRef(new Map());
  const peerDeviceIdsRef = useRef(new Map());
  const participantDisplayNamesRef = useRef(new Map());
  const hostConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const handlersRef = useRef(new Set());
  const hostPresentTimerRef = useRef(null);
  const openCountRef = useRef(0);
  const signalingOpenRef = useRef(false);
  const retryTimerRef = useRef(null);
  const connectRetryTimerRef = useRef(null);
  const connectToHostRef = useRef(() => {});
  const connectTimeoutRef = useRef(null);
  const retryAttemptRef = useRef(0);
  const localParticipantIdRef = useRef("");
  const teardownPeerRef = useRef(() => {});
  const displayNameRef = useRef("");
  const hostAudioMutedRef = useRef(false);
  const hostVideoMutedRef = useRef(false);
  const hostModeRef = useRef("available");
  const participantModeRef = useRef(PARTICIPANT_MODE.AVAILABLE);
  const sendParticipantProfileRef = useRef(() => false);
  const onRemoteParticipantRef = useRef();
  const onRemoteHostStreamRef = useRef();
  const onChatMessageRef = useRef(null);
  const sessionTitleRef = useRef("");
  const hostDisplayNameRef = useRef("");
  const roomIdRef = useRef(roomId);
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
      typeof onRemoteParticipant === "function"
        ? onRemoteParticipant
        : undefined;
    onRemoteHostStreamRef.current =
      typeof onRemoteHostStream === "function" ? onRemoteHostStream : undefined;
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

  const updateConnectedState = useCallback((delta) => {
    openCountRef.current = Math.max(0, openCountRef.current + delta);
    const connected = openCountRef.current > 0;
    setIsConnected(connected);
    if (connected) {
      setConnectionError(null);
      retryAttemptRef.current = 0;
    }
  }, []);

  const notifyHandlers = useCallback((message) => {
    for (const handler of handlersRef.current) {
      handler(message);
    }
  }, []);

  const subscribe = useCallback((handler) => {
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
    (message) => {
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

  const enqueueSync = useCallback((overrides = {}) => {
    if (Object.hasOwn(overrides, "localStream"))
      localStreamRef.current = overrides.localStream;
    if (Object.hasOwn(overrides, "screenStream"))
      screenStreamRef.current = overrides.screenStream;
    return audienceRef.current?.sync() ?? Promise.resolve();
  }, []);

  const onMediaOpen = useCallback(
    (id) => audienceRef.current?.connectionOpen(id),
    [],
  );
  const onMediaClose = useCallback(
    (id) => audienceRef.current?.connectionClose(id),
    [],
  );
  const onMediaControl = useCallback(
    (id, message) => audienceRef.current?.handleControl(id, message),
    [],
  );

  const bindConnection = useCallback(
    (conn, { remoteId, remoteName = "Guest" }) => {
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
    ({ nextDisplayName, nextParticipantMode } = {}) => {
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
    (participantId, message) => {
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
    (message, recipientId) => {
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
    (text) => {
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
    (text, recipientId) => {
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
    (restart) => {
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

    const createPeer = (Peer, id) => {
      if (destroyedRef.current) return null;

      teardownPeer();
      scheduleConnectTimeout();
      const baseOptions = peerConfigRef.current ?? peerConfig;
      const options = {
        ...baseOptions,
        token: peerAuthToken,
        config: { iceServers: iceServersRef.current ?? iceServers },
      };
      const peer = new Peer(id, options);
      peerRef.current = peer;
      audienceRef.current = new AudienceMediaController({
        isHost,
        localId: id,
        hostId: hostPeerId(roomId),
        getPeer: () => peerRef.current,
        getLocalStream: () =>
          buildOutboundMediaStream(
            localStreamRef.current,
            screenStreamRef.current,
          ),
        sendControl: (target, message) =>
          sendOnConnection(
            isHost
              ? connectionsRef.current.get(target)
              : hostConnectionRef.current,
            message,
          ),
        onStream: (sourceId, stream) => {
          if (!isHost && sourceId === hostPeerId(roomId))
            onRemoteHostStreamRef.current?.(stream);
          else
            onRemoteParticipantRef.current?.({
              id: sourceId,
              stream,
              preserveProfile: true,
            });
        },
        onState: setAudienceState,
        rejectPeer: (target) =>
          setTimeout(() => connectionsRef.current.get(target)?.close(), 500),
      });
      return peer;
    };

    const startHostPeer = (Peer) => {
      const peer = createPeer(Peer, hostPeerId(roomId));
      if (!peer) return;

      peer.on("open", () => {
        if (destroyedRef.current || peer !== peerRef.current) return;
        signalingOpenRef.current = true;
        setLocalParticipantId(hostPeerId(roomId));
        clearConnectTimeout();
        setConnectionError(null);
        retryAttemptRef.current = 0;

        void audienceRef.current?.sync();
      });

      peer.on("disconnected", () => {
        if (destroyedRef.current || peer.destroyed || peer !== peerRef.current)
          return;
        console.warn(
          "[peer] host disconnected from signaling server, reconnecting...",
        );
        audienceRef.current?.restartEpoch();
        peer.reconnect();
      });

      peer.on("connection", (conn) => {
        if (destroyedRef.current || peer !== peerRef.current) return;
        const remoteId = conn.peer;

        if (connectionsRef.current.has(remoteId)) {
          conn.close();
          return;
        }

        if (connectionsRef.current.size >= MAX_PARTICIPANT_CONNECTIONS) {
          const rejectConnection = () => {
            try {
              conn.send(JSON.stringify(createRoomFullMessage()));
            } catch (err) {
              console.warn("[peer] failed to send room_full signal", err);
            }
            setTimeout(() => {
              conn.close();
            }, 500);
          };

          if (conn.open) {
            rejectConnection();
          } else {
            conn.on("open", rejectConnection);
          }
          return;
        }

        connectionsRef.current.set(remoteId, conn);
        bindConnection(conn, { remoteId, remoteName: "Guest" });
        conn.on("close", () => {
          if (connectionsRef.current.get(remoteId) !== conn) return;
          connectionsRef.current.delete(remoteId);
          peerDeviceIdsRef.current.delete(remoteId);
          participantDisplayNamesRef.current.delete(remoteId);
        });
      });

      peer.on("call", (call) => {
        if (destroyedRef.current || peer !== peerRef.current) return;
        audienceRef.current?.handleCall(call);
      });

      peer.on("error", (error) => {
        if (destroyedRef.current || peer !== peerRef.current) return;
        console.warn("[peer] host error", error);

        if (error?.type === "unavailable-id") {
          setConnectionError(SIGNALING_ERROR.HOST_ID_RECONNECTING);
          clearRetryTimer();
          if (retryAttemptRef.current >= MAX_HOST_ID_RETRIES) {
            setConnectionError(hostSignalingRetryExhaustedError());
            return;
          }
          const delay = hostIdRetryDelayMs(retryAttemptRef.current);
          retryAttemptRef.current += 1;
          // startHostPeer tears down any prior peer before reclaiming the ID.
          retryTimerRef.current = window.setTimeout(() => {
            startHostPeer(Peer);
          }, delay);
          scheduleConnectTimeout();
          return;
        }

        if (isRetryablePeerError(error)) {
          setConnectionError(peerErrorMessage(error, { isHost: true }));
          schedulePeerRetry(() => startHostPeer(Peer));
          return;
        }

        setConnectionError(peerErrorMessage(error, { isHost: true }));
      });
    };

    const startParticipantPeer = (Peer) => {
      const peer = createPeer(Peer, peerId);
      if (!peer) return;

      const connectToHost = () => {
        if (
          destroyedRef.current ||
          !peerRef.current ||
          hostConnectionRef.current?.open
        ) {
          return;
        }

        hostConnectionRef.current?.close();
        hostConnectionRef.current = null;

        const conn = peer.connect(hostPeerId(roomId));
        hostConnectionRef.current = conn;
        bindConnection(conn, {
          remoteId: peer.id ?? "guest",
          remoteName: "Guest",
        });

        conn.on("error", (error) => {
          if (destroyedRef.current) return;
          setConnectionError(peerErrorMessage(error, { isHost: false }));
          scheduleReconnectToHost();
        });
      };
      connectToHostRef.current = connectToHost;

      peer.on("call", (call) => {
        if (destroyedRef.current || peer !== peerRef.current) return;
        audienceRef.current?.handleCall(call);
      });

      peer.on("open", (id) => {
        if (destroyedRef.current || peer !== peerRef.current) return;
        signalingOpenRef.current = true;
        clearConnectTimeout();
        localParticipantIdRef.current = id;
        setLocalParticipantId(id);
        setConnectionError(null);
        retryAttemptRef.current = 0;
        connectToHost();
      });

      peer.on("disconnected", () => {
        if (destroyedRef.current || peer.destroyed || peer !== peerRef.current)
          return;
        console.warn(
          "[peer] participant disconnected from signaling server, reconnecting...",
        );
        peer.reconnect();
      });

      peer.on("error", (error) => {
        if (destroyedRef.current || peer !== peerRef.current) return;

        if (error?.type === "peer-unavailable") {
          setConnectionError(peerErrorMessage(error, { isHost: false }));
          scheduleReconnectToHost();
          return;
        }

        console.warn("[peer] participant error", error);

        if (isRetryablePeerError(error)) {
          setConnectionError(peerErrorMessage(error, { isHost: false }));
          schedulePeerRetry(() => startParticipantPeer(Peer));
          return;
        }

        setConnectionError(peerErrorMessage(error, { isHost: false }));
      });
    };

    void loadPeer().then((Peer) => {
      if (destroyedRef.current) return;
      if (isHost) {
        startHostPeer(Peer);
      } else {
        startParticipantPeer(Peer);
      }
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
    hostPresentTimerRef.current = setInterval(
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
