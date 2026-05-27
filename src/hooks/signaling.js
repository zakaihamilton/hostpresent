"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isSignalingMessage,
  parseSignalingMessage,
} from "@/lib/signaling/messages";

const SIGNALING_STATUS = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "error",
};

export function useSignaling({ token, enabled = true }) {
  const handlersRef = useRef(new Set());
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const [status, setStatus] = useState(SIGNALING_STATUS.DISCONNECTED);

  const notifyHandlers = useCallback((message) => {
    for (const handler of handlersRef.current) {
      handler(message);
    }
  }, []);

  const subscribe = useCallback((handler) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setStatus(SIGNALING_STATUS.DISCONNECTED);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !token || typeof EventSource === "undefined") {
      disconnect();
      return;
    }

    disconnect();
    setStatus(SIGNALING_STATUS.CONNECTING);

    const streamUrl = `/api/rooms/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus(SIGNALING_STATUS.CONNECTED);
    };

    eventSource.addEventListener("signaling", (event) => {
      try {
        const message = parseSignalingMessage(event.data);
        if (isSignalingMessage(message)) {
          notifyHandlers(message);
        }
      } catch (error) {
        console.warn("[signaling] Failed to parse signaling event", error);
      }
    });

    eventSource.onerror = () => {
      setStatus(SIGNALING_STATUS.ERROR);
      eventSource.close();
      eventSourceRef.current = null;

      if (enabled && token) {
        reconnectTimerRef.current = setTimeout(connect, 3000);
      }
    };
  }, [disconnect, enabled, notifyHandlers, token]);

  const send = useCallback(
    async (message) => {
      if (!isSignalingMessage(message)) {
        console.warn("[signaling] Ignored invalid outbound message", message);
        return false;
      }

      if (!token) {
        if (process.env.NODE_ENV !== "production") {
          console.debug("[signaling mock send]", message);
        }
        return false;
      }

      try {
        const response = await fetch("/api/rooms/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, message }),
        });
        return response.ok;
      } catch (error) {
        console.warn("[signaling] Failed to send message", error);
        return false;
      }
    },
    [token],
  );

  useEffect(() => {
    if (!enabled || !token) {
      disconnect();
      return undefined;
    }

    connect();
    return disconnect;
  }, [connect, disconnect, enabled, token]);

  return {
    status,
    isConnected: status === SIGNALING_STATUS.CONNECTED,
    isMockMode: !token,
    send,
    subscribe,
    connect,
    disconnect,
  };
}
