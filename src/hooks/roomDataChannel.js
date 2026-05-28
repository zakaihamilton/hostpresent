"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIceServers } from "@/components/webrtc/PeerStreamConnection";
import {
  canReceiveSignalingMessage,
  canSendSignalingMessage,
  isParticipantStatusMessage,
  resolveParticipantStatusMessage,
} from "@/lib/room/messageAuth";
import { PARTICIPANT_MODE } from "@/lib/settings/displayNameSettings";
import {
  createChatMessage,
  createChatPrivateMessage,
  createHostPresentMessage,
  createParticipantProfileMessage,
  isChatMessage,
  isSignalingMessage,
  parseSignalingMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import {
  buildOutboundMediaStream,
  destroyOutboundAudioMixer,
  syncOutboundTracks,
} from "@/lib/webrtc/outboundMedia";
import {
  connectionRetryDelayMs,
  HOST_ID_RETRY_DELAY_MS,
  hostPeerId,
  hostSignalingRetryExhaustedError,
  hostSignalingTimeoutError,
  isRetryablePeerError,
  isWaitingForHostMessage,
  loadPeer,
  MAX_SIGNALING_RETRIES,
  participantSignalingRetryExhaustedError,
  participantSignalingTimeoutError,
  peerErrorMessage,
  SIGNALING_CONNECT_TIMEOUT_MS,
  SIGNALING_ERROR,
} from "@/lib/webrtc/peerClient";
import { fetchPeerJsConfig } from "@/lib/webrtc/signalingConfig";

const SIGNALING_NOT_CONFIGURED_ERROR = SIGNALING_ERROR.NOT_CONFIGURED;

const HOST_PRESENT_INTERVAL_MS = 5000;
const CONNECT_RETRY_MS = 2000;

function sendOnConnection(conn, message) {
  if (!conn?.open) return false;
  try {
    conn.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}

export function useRoomDataChannel({
  role,
  token,
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
  const iceServers = useIceServers();

  const peerRef = useRef(null);
  const peerConfigRef = useRef(null);
  const iceServersRef = useRef(null);
  const connectionsRef = useRef(new Map());
  const mediaCallsRef = useRef(new Map());
  const inboundStreamsRef = useRef(new Map());
  const relayCallsRef = useRef(new Map());
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
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const clearConnectRetryTimer = useCallback(() => {
    if (connectRetryTimerRef.current) {
      window.clearTimeout(connectRetryTimerRef.current);
      connectRetryTimerRef.current = null;
    }
  }, []);

  const scheduleReconnectToHost = useCallback(() => {
    if (isHost || destroyedRef.current) return;

    clearConnectRetryTimer();
    hostConnectionRef.current?.close();
    hostConnectionRef.current = null;
    setHostPresent(false);
    onRemoteHostStreamRef.current?.(null);

    const currentRoomId = roomIdRef.current;
    if (currentRoomId) {
      const hostId = hostPeerId(currentRoomId);
      const hostCall = mediaCallsRef.current.get(hostId);
      if (hostCall) {
        hostCall.close();
        mediaCallsRef.current.delete(hostId);
      }
    }

    if (openCountRef.current <= 0) {
      setConnectionError((previous) => {
        if (isWaitingForHostMessage(previous)) return previous;
        return peerErrorMessage({ type: "peer-unavailable" }, { isHost: false });
      });
    }

    connectRetryTimerRef.current = window.setTimeout(() => {
      if (destroyedRef.current) return;
      connectToHostRef.current();
    }, CONNECT_RETRY_MS);
  }, [clearConnectRetryTimer, isHost]);

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current) {
      window.clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
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

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  const relayCallKey = (viewerId, sourceId) => `${viewerId}:${sourceId}`;

  const closeRelayCallsForViewer = useCallback((viewerId) => {
    for (const [key, call] of relayCallsRef.current.entries()) {
      if (key.startsWith(`${viewerId}:`)) {
        call.close();
        relayCallsRef.current.delete(key);
      }
    }
  }, []);

  const closeRelayCallsForSource = useCallback((sourceId) => {
    for (const [key, call] of relayCallsRef.current.entries()) {
      if (key.endsWith(`:${sourceId}`)) {
        call.close();
        relayCallsRef.current.delete(key);
      }
    }
    inboundStreamsRef.current.delete(sourceId);
  }, []);

  const ensureRelayCall = useCallback(
    (viewerId, sourceId) => {
      if (!isHost || viewerId === sourceId) return;

      const stream = inboundStreamsRef.current.get(sourceId);
      const peer = peerRef.current;
      if (!stream || !peer) return;

      const key = relayCallKey(viewerId, sourceId);
      if (relayCallsRef.current.has(key)) return;

      try {
        const call = peer.call(viewerId, stream, {
          metadata: { relayFrom: sourceId },
        });
        if (!call) return;
        relayCallsRef.current.set(key, call);
        call.on("close", () => {
          if (relayCallsRef.current.get(key) === call) {
            relayCallsRef.current.delete(key);
          }
        });
      } catch (error) {
        console.warn("[peer] relay call failed", error);
      }
    },
    [isHost],
  );

  const syncRelayForViewer = useCallback(
    (viewerId) => {
      if (!isHost) return;
      for (const sourceId of inboundStreamsRef.current.keys()) {
        ensureRelayCall(viewerId, sourceId);
      }
    },
    [ensureRelayCall, isHost],
  );

  const syncRelayForSource = useCallback(
    (sourceId, stream) => {
      if (!isHost) return;
      if (!stream) {
        closeRelayCallsForSource(sourceId);
        return;
      }
      inboundStreamsRef.current.set(sourceId, stream);
      for (const viewerId of connectionsRef.current.keys()) {
        ensureRelayCall(viewerId, sourceId);
      }
    },
    [closeRelayCallsForSource, ensureRelayCall, isHost],
  );

  const bindMediaCall = useCallback(
    (call, remoteId) => {
      if (!call) return;

      const relayFrom =
        typeof call.metadata?.relayFrom === "string"
          ? call.metadata.relayFrom
          : null;
      const participantId = relayFrom || remoteId;

      if (!relayFrom) {
        const existing = mediaCallsRef.current.get(remoteId);
        if (existing && existing !== call) {
          existing.close();
        }
        mediaCallsRef.current.set(remoteId, call);
      }

      call.on("stream", (remoteStream) => {
        if (destroyedRef.current) return;
        if (isHost) {
          onRemoteParticipantRef.current?.({
            id: participantId,
            stream: remoteStream,
          });
          if (!relayFrom) {
            syncRelayForSource(participantId, remoteStream);
          }
          return;
        }
        if (relayFrom) {
          onRemoteParticipantRef.current?.({
            id: relayFrom,
            stream: remoteStream,
          });
          return;
        }
        onRemoteHostStreamRef.current?.(remoteStream);
      });

      call.on("close", () => {
        if (destroyedRef.current) return;
        if (!relayFrom && mediaCallsRef.current.get(remoteId) === call) {
          mediaCallsRef.current.delete(remoteId);
        }
        if (isHost) {
          if (!relayFrom) {
            onRemoteParticipantRef.current?.({ id: participantId, stream: null });
            syncRelayForSource(participantId, null);
          }
          return;
        }
        if (relayFrom) {
          onRemoteParticipantRef.current?.({ id: relayFrom, stream: null });
          return;
        }
        onRemoteHostStreamRef.current?.(null);
      });

      call.on("error", (error) => {
        if (destroyedRef.current) return;
        console.warn("[peer] media call error", error);
      });
    },
    [isHost, syncRelayForSource],
  );

  const answerIncomingCall = useCallback(
    (call, remoteId, { receiveOnly = false } = {}) => {
      bindMediaCall(call, remoteId);
      if (receiveOnly) {
        call.answer();
        return;
      }
      void (async () => {
        if (destroyedRef.current) return;
        const outbound = await buildOutboundMediaStream(
          localStreamRef.current,
          screenStreamRef.current,
        );
        if (destroyedRef.current) return;
        if (outbound) {
          call.answer(outbound);
        } else {
          call.answer();
        }
      })().catch((error) => {
        console.warn("[peer] handle incoming call failed", error);
      });
    },
    [bindMediaCall],
  );

  const ensureMediaCall = useCallback(
    async (remoteId) => {
      const next = syncQueueRef.current.then(async () => {
        const peer = peerRef.current;
        if (!peer) return;

        const outbound = await buildOutboundMediaStream(
          localStreamRef.current,
          screenStreamRef.current,
        );
        if (!outbound) return;

        const existing = mediaCallsRef.current.get(remoteId);
        if (existing) {
          const peerConnection = existing.peerConnection;
          if (
            peerConnection &&
            peerConnection.connectionState !== "closed"
          ) {
            await syncOutboundTracks(
              existing,
              localStreamRef.current,
              screenStreamRef.current,
            );
          }
          return;
        }

        const call = peer.call(remoteId, outbound);
        if (!call) return;
        bindMediaCall(call, remoteId);
      });
      syncQueueRef.current = next.catch(() => {});
      return next;
    },
    [bindMediaCall],
  );

  const syncQueueRef = useRef(Promise.resolve());

  const enqueueSync = useCallback(async () => {
    const next = syncQueueRef.current.then(async () => {
      const tasks = [];
      for (const call of mediaCallsRef.current.values()) {
        tasks.push(
          syncOutboundTracks(
            call,
            localStreamRef.current,
            screenStreamRef.current,
          ),
        );
      }
      await Promise.all(tasks);

      if (isHost) {
        for (const remoteId of connectionsRef.current.keys()) {
          await ensureMediaCall(remoteId);
        }
      }
    });
    syncQueueRef.current = next.catch(() => {});
    return next;
  }, [isHost, ensureMediaCall]);

  useEffect(() => {
    if (!localStream && !screenStream) return undefined;
    enqueueSync().catch((error) => {
      console.warn("[peer] syncAllOutboundTracks failed", error);
    });
  }, [localStream, screenStream, enqueueSync]);

  const bindConnection = useCallback(
    (conn, { remoteId, remoteName = "Guest" }) => {
      const handleOpen = () => {
        if (destroyedRef.current) return;
        updateConnectedState(1);
        if (isHost) {
          sendOnConnection(conn, createHostPresencePayload());
          onRemoteParticipantRef.current?.({ id: remoteId, name: remoteName });
          ensureMediaCall(remoteId).catch((error) => {
            console.warn("[peer] placeOutgoingMediaCall failed", error);
          });
          syncRelayForViewer(remoteId);
          return;
        }

        sendParticipantProfileRef.current();
      };

      if (conn.open) {
        handleOpen();
      } else {
        conn.on("open", handleOpen);
      }

      conn.on("close", () => {
        if (destroyedRef.current) return;
        updateConnectedState(-1);
        if (isHost) {
          onRemoteParticipantRef.current?.({ id: remoteId, stream: null });
          return;
        }
        scheduleReconnectToHost();
      });

      conn.on("data", (raw) => {
        if (destroyedRef.current) return;
        try {
          const payload = typeof raw === "string" ? raw : JSON.stringify(raw);
          const message = parseSignalingMessage(payload);

          if (isChatMessage(message)) {
            if (isHost) {
              if (message.type === SIGNALING_MESSAGE.CHAT_MESSAGE) {
                for (const [id, c] of connectionsRef.current) {
                  if (id !== remoteId) {
                    sendOnConnection(c, message);
                  }
                }
              }
              if (
                message.type === SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE &&
                message.recipientId
              ) {
                const recipientConn = connectionsRef.current.get(
                  message.recipientId,
                );
                if (recipientConn) {
                  sendOnConnection(recipientConn, message);
                }
              }
            }
            notifyHandlers(message);
            if (onChatMessageRef.current) {
              onChatMessageRef.current(message);
            }
            return;
          }

          if (!isSignalingMessage(message)) return;
          const resolvedMessage = resolveParticipantStatusMessage(message, {
            senderId: remoteId,
          });
          if (
            !canReceiveSignalingMessage({
              isHost,
              message: resolvedMessage,
              senderId: remoteId,
              localParticipantId: localParticipantIdRef.current,
            })
          ) {
            return;
          }
          notifyHandlers(resolvedMessage);
          if (!isHost && message.type === SIGNALING_MESSAGE.HOST_PRESENT) {
            setHostPresent(true);
            setConnectionError(null);
          }
        } catch (error) {
          console.warn("[peer] invalid message", error);
        }
      });
    },
    [
      createHostPresencePayload,
      ensureMediaCall,
      isHost,
      notifyHandlers,
      scheduleReconnectToHost,
      syncRelayForViewer,
      updateConnectedState,
    ],
  );

  const sendParticipantProfile = useCallback(() => {
    if (isHost) return false;

    const participantId = localParticipantIdRef.current;
    if (!participantId || !hostConnectionRef.current?.open) {
      return false;
    }

    return sendOnConnection(
      hostConnectionRef.current,
      createParticipantProfileMessage({
        participantId,
        displayName: displayNameRef.current,
        mode: participantModeRef.current,
      }),
    );
  }, [isHost]);

  useEffect(() => {
    sendParticipantProfileRef.current = sendParticipantProfile;
  }, [sendParticipantProfile]);

  useEffect(() => {
    if (isHost) return undefined;
    sendParticipantProfile();
  }, [
    displayName,
    isHost,
    localParticipantId,
    participantMode,
    sendParticipantProfile,
  ]);

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

      if (isHost) {
        let sent = false;
        for (const conn of connectionsRef.current.values()) {
          if (sendOnConnection(conn, message)) sent = true;
        }
        notifyHandlers(message);
        if (onChatMessageRef.current) {
          onChatMessageRef.current(message);
        }
        return sent;
      }

      const sent = sendOnConnection(hostConnectionRef.current, message);
      if (sent && onChatMessageRef.current) {
        onChatMessageRef.current(message);
      }
      return sent;
    },
    [isHost, roomId],
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

      if (isHost) {
        const conn = connectionsRef.current.get(recipientId);
        const sent = sendOnConnection(conn, message);
        notifyHandlers(message);
        if (onChatMessageRef.current) {
          onChatMessageRef.current(message);
        }
        return sent;
      }

      const sent = sendOnConnection(hostConnectionRef.current, message);
      if (sent && onChatMessageRef.current) {
        onChatMessageRef.current(message);
      }
      return sent;
    },
    [isHost, roomId],
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

  useEffect(() => {
    if (!configReady || !peerConfig || !iceServers) {
      return undefined;
    }

    if (!enabled || !token || !roomId || typeof window === "undefined") {
      return undefined;
    }

    destroyedRef.current = false;

    const teardownPeer = () => {
      for (const call of mediaCallsRef.current.values()) {
        call.close();
      }
      mediaCallsRef.current.clear();
      for (const call of relayCallsRef.current.values()) {
        call.close();
      }
      relayCallsRef.current.clear();
      inboundStreamsRef.current.clear();
      for (const conn of connectionsRef.current.values()) {
        conn.close();
      }
      connectionsRef.current.clear();
      hostConnectionRef.current?.close();
      hostConnectionRef.current = null;
      peerRef.current?.destroy();
      peerRef.current = null;
      openCountRef.current = 0;
      signalingOpenRef.current = false;
      localParticipantIdRef.current = "";
      destroyOutboundAudioMixer();
    };
    teardownPeerRef.current = teardownPeer;

    const startHostPeer = (Peer) => {
      if (destroyedRef.current) return;

      teardownPeer();
      scheduleConnectTimeout();
      const baseOptions = peerConfigRef.current ?? peerConfig;
      const options = {
        ...baseOptions,
        config: { iceServers: iceServersRef.current ?? iceServers },
      };
      const peer = new Peer(hostPeerId(roomId), options);
      peerRef.current = peer;

      peer.on("open", () => {
        if (destroyedRef.current) return;
        signalingOpenRef.current = true;
        clearConnectTimeout();
        setConnectionError(null);
        retryAttemptRef.current = 0;

        for (const remoteId of connectionsRef.current.keys()) {
          ensureMediaCall(remoteId).catch((error) => {
            console.warn("[peer] resync host media after signaling open failed", error);
          });
        }
      });

      peer.on("disconnected", () => {
        if (destroyedRef.current) return;
        console.warn(
          "[peer] host disconnected from signaling server, reconnecting...",
        );
        peer.reconnect();
      });

      peer.on("connection", (conn) => {
        if (destroyedRef.current) return;
        const remoteId = conn.peer;
        connectionsRef.current.set(remoteId, conn);
        bindConnection(conn, { remoteId, remoteName: "Guest" });
        conn.on("close", () => {
          connectionsRef.current.delete(remoteId);
          mediaCallsRef.current.get(remoteId)?.close();
          mediaCallsRef.current.delete(remoteId);
          closeRelayCallsForViewer(remoteId);
          closeRelayCallsForSource(remoteId);
        });
      });

      peer.on("call", (call) => {
        if (destroyedRef.current) return;
        answerIncomingCall(call, call.peer);
      });

      peer.on("error", (error) => {
        if (destroyedRef.current) return;
        console.warn("[peer] host error", error);

        if (error?.type === "unavailable-id") {
          setConnectionError(SIGNALING_ERROR.HOST_ID_RECONNECTING);
          clearRetryTimer();
          retryAttemptRef.current += 1;
          if (retryAttemptRef.current >= MAX_SIGNALING_RETRIES) {
            setConnectionError(hostSignalingRetryExhaustedError());
            return;
          }
          retryTimerRef.current = window.setTimeout(() => {
            startHostPeer(Peer);
          }, HOST_ID_RETRY_DELAY_MS);
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
      if (destroyedRef.current) return;

      teardownPeer();
      scheduleConnectTimeout();
      const baseOptions = peerConfigRef.current ?? peerConfig;
      const options = {
        ...baseOptions,
        config: { iceServers: iceServersRef.current ?? iceServers },
      };
      const peer = new Peer(undefined, options);
      peerRef.current = peer;

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
        if (destroyedRef.current) return;
        const relayFrom =
          typeof call.metadata?.relayFrom === "string"
            ? call.metadata.relayFrom
            : null;
        if (relayFrom) {
          answerIncomingCall(call, relayFrom, { receiveOnly: true });
          return;
        }
        answerIncomingCall(call, hostPeerId(roomId));
      });

      peer.on("open", (id) => {
        if (destroyedRef.current) return;
        signalingOpenRef.current = true;
        clearConnectTimeout();
        localParticipantIdRef.current = id;
        setLocalParticipantId(id);
        setConnectionError(null);
        retryAttemptRef.current = 0;
        connectToHost();
      });

      peer.on("disconnected", () => {
        if (destroyedRef.current) return;
        console.warn(
          "[peer] participant disconnected from signaling server, reconnecting...",
        );
        peer.reconnect();
      });

      peer.on("error", (error) => {
        if (destroyedRef.current) return;
        console.warn("[peer] participant error", error);

        if (error?.type === "peer-unavailable") {
          setConnectionError(peerErrorMessage(error, { isHost: false }));
          scheduleReconnectToHost();
          return;
        }

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
    answerIncomingCall,
    bindConnection,
    clearConnectRetryTimer,
    clearConnectTimeout,
    clearRetryTimer,
    configReady,
    enabled,
    ensureMediaCall,
    iceServers,
    isHost,
    peerConfig,
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

  const status =
    connectionError && !isConnected
      ? "error"
      : isConnected
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
    isConnected,
    hostPresent,
    localParticipantId,
    connectionError,
    signalingConfigured: Boolean(peerConfig),
    status,
  };
}
