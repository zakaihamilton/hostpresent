"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createHostPresentMessage,
  isSignalingMessage,
  parseSignalingMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import {
  connectionRetryDelayMs,
  hostPeerId,
  isRetryablePeerError,
  isWaitingForHostMessage,
  loadPeer,
  MAX_SIGNALING_RETRIES,
  peerErrorMessage,
  SIGNALING_CONNECT_TIMEOUT_MS,
} from "@/lib/webrtc/peerClient";
import { fetchPeerJsConfig } from "@/lib/webrtc/signalingConfig";

const SIGNALING_NOT_CONFIGURED_ERROR =
  "Signaling server is not configured. Set SIGNALING_SERVER_URL on the server to your PeerJS hostname.";

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
  onRemoteParticipant,
}) {
  const isHost = role === "host";
  const [isConnected, setIsConnected] = useState(false);
  const [hostPresent, setHostPresent] = useState(isHost);
  const [localParticipantId, setLocalParticipantId] = useState("");
  const [connectionError, setConnectionError] = useState(null);
  const [peerConfig, setPeerConfig] = useState(null);
  const [configReady, setConfigReady] = useState(false);

  const peerRef = useRef(null);
  const peerConfigRef = useRef(null);
  const connectionsRef = useRef(new Map());
  const hostConnectionRef = useRef(null);
  const handlersRef = useRef(new Set());
  const hostPresentTimerRef = useRef(null);
  const openCountRef = useRef(0);
  const signalingOpenRef = useRef(false);
  const retryTimerRef = useRef(null);
  const retryAttemptRef = useRef(0);
  const connectRetryTimerRef = useRef(null);

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

  const bindConnection = useCallback(
    (conn, { remoteId, remoteName = "Guest" }) => {
      conn.on("open", () => {
        updateConnectedState(1);
        if (isHost) {
          sendOnConnection(conn, createHostPresentMessage());
          onRemoteParticipant?.({ id: remoteId, name: remoteName });
        }
      });

      conn.on("close", () => {
        updateConnectedState(-1);
      });

      conn.on("data", (raw) => {
        try {
          const payload = typeof raw === "string" ? raw : JSON.stringify(raw);
          const message = parseSignalingMessage(payload);
          if (!isSignalingMessage(message)) return;
          notifyHandlers(message);
          if (!isHost && message.type === SIGNALING_MESSAGE.HOST_PRESENT) {
            setHostPresent(true);
            setConnectionError(null);
          }
        } catch (error) {
          console.warn("[peer] invalid message", error);
        }
      });
    },
    [isHost, notifyHandlers, onRemoteParticipant, updateConnectedState],
  );

  const send = useCallback(
    (message) => {
      if (!isSignalingMessage(message)) return false;

      if (isHost) {
        const targetId = message.participantId;
        if (
          targetId &&
          (message.type === SIGNALING_MESSAGE.HOST_MUTE_AUDIO ||
            message.type === SIGNALING_MESSAGE.HOST_MUTE_VIDEO)
        ) {
          const conn = connectionsRef.current.get(targetId);
          return sendOnConnection(conn, message);
        }

        let sent = false;
        for (const conn of connectionsRef.current.values()) {
          if (sendOnConnection(conn, message)) sent = true;
        }
        return sent;
      }

      return sendOnConnection(hostConnectionRef.current, message);
    },
    [isHost],
  );

  const schedulePeerRetry = useCallback(
    (restart) => {
      if (!peerConfigRef.current) return;

      if (retryAttemptRef.current >= MAX_SIGNALING_RETRIES) {
        setConnectionError(
          isHost
            ? "Unable to connect to the signaling server. Verify SIGNALING_SERVER_URL is set on the server and that your PeerJS server is running."
            : "Could not connect to the meeting. Make sure the host has joined and the signaling server is reachable.",
        );
        return;
      }

      clearRetryTimer();
      const delay = connectionRetryDelayMs(retryAttemptRef.current);
      retryAttemptRef.current += 1;
      retryTimerRef.current = window.setTimeout(() => {
        restart();
      }, delay);
    },
    [clearRetryTimer, isHost],
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
      .catch(() => {
        if (cancelled) return;
        setConnectionError("Could not load signaling configuration.");
        setConfigReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!configReady || !peerConfig) {
      return undefined;
    }

    if (!enabled || !token || !roomId || typeof window === "undefined") {
      return undefined;
    }

    let destroyed = false;

    const teardownPeer = () => {
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
    };

    const startHostPeer = (Peer) => {
      if (destroyed) return;

      teardownPeer();
      const options = peerConfigRef.current ?? peerConfig;
      const peer = new Peer(hostPeerId(roomId), options);
      peerRef.current = peer;

      peer.on("open", () => {
        if (destroyed) return;
        signalingOpenRef.current = true;
        setConnectionError(null);
        retryAttemptRef.current = 0;
      });

      peer.on("connection", (conn) => {
        const remoteId = conn.peer;
        connectionsRef.current.set(remoteId, conn);
        bindConnection(conn, { remoteId, remoteName: "Guest" });
        conn.on("close", () => {
          connectionsRef.current.delete(remoteId);
        });
      });

      peer.on("error", (error) => {
        if (destroyed) return;
        console.warn("[peer] host error", error);

        if (error?.type === "unavailable-id") {
          schedulePeerRetry(() => startHostPeer(Peer));
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
      if (destroyed) return;

      teardownPeer();
      const options = peerConfigRef.current ?? peerConfig;
      const peer = new Peer(undefined, options);
      peerRef.current = peer;

      const connectToHost = () => {
        if (destroyed || !peerRef.current || hostConnectionRef.current?.open) {
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
          if (destroyed) return;
          hostConnectionRef.current = null;
          setConnectionError(peerErrorMessage(error, { isHost: false }));
          clearConnectRetryTimer();
          connectRetryTimerRef.current = window.setTimeout(
            connectToHost,
            CONNECT_RETRY_MS,
          );
        });
      };

      peer.on("open", (id) => {
        if (destroyed) return;
        signalingOpenRef.current = true;
        setLocalParticipantId(id);
        setConnectionError(null);
        retryAttemptRef.current = 0;
        connectToHost();
      });

      peer.on("error", (error) => {
        if (destroyed) return;
        console.warn("[peer] participant error", error);

        if (error?.type === "peer-unavailable") {
          setConnectionError(peerErrorMessage(error, { isHost: false }));
          clearConnectRetryTimer();
          connectRetryTimerRef.current = window.setTimeout(
            connectToHost,
            CONNECT_RETRY_MS,
          );
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
      if (destroyed) return;
      if (isHost) {
        startHostPeer(Peer);
      } else {
        startParticipantPeer(Peer);
      }
    });

    return () => {
      destroyed = true;
      clearRetryTimer();
      clearConnectRetryTimer();
      if (hostPresentTimerRef.current) {
        clearInterval(hostPresentTimerRef.current);
      }
      teardownPeer();
    };
  }, [
    bindConnection,
    clearConnectRetryTimer,
    clearRetryTimer,
    configReady,
    enabled,
    isHost,
    peerConfig,
    roomId,
    schedulePeerRetry,
    token,
  ]);

  useEffect(() => {
    if (!configReady || !peerConfig || !enabled || !token || !roomId) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (signalingOpenRef.current) {
        if (isHost) return;
        setConnectionError((previous) => {
          if (isWaitingForHostMessage(previous)) return previous;
          if (openCountRef.current > 0) return null;
          return previous ?? "Waiting for the host to join…";
        });
        return;
      }

      if (openCountRef.current > 0) return;
      setConnectionError((previous) => {
        if (isWaitingForHostMessage(previous)) return previous;
        return isHost
          ? "Unable to connect to the signaling server. Check .env.local and that your PeerJS server is running."
          : "Could not connect to the meeting. Make sure the host has joined and the signaling server is reachable.";
      });
    }, SIGNALING_CONNECT_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [configReady, enabled, isHost, peerConfig, roomId, token]);

  useEffect(() => {
    if (!enabled || !isHost || !token) return undefined;

    const announce = () => send(createHostPresentMessage());
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
  }, [enabled, isHost, send, token]);

  const status = connectionError && !isConnected
    ? "error"
    : isConnected
      ? "connected"
      : "connecting";

  return {
    send,
    subscribe,
    isConnected,
    hostPresent,
    localParticipantId,
    connectionError,
    signalingConfigured: Boolean(peerConfig),
    status,
  };
}
