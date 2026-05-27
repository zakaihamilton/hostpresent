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

export function useSignaling({ url, enabled = true }) {
  const wsRef = useRef(null);
  const handlersRef = useRef(new Set());
  const reconnectTimerRef = useRef(null);
  const [status, setStatus] = useState(SIGNALING_STATUS.DISCONNECTED);

  const notifyHandlers = useCallback((message) => {
    for (const handler of handlersRef.current) {
      handler(message);
    }
  }, []);

  const send = useCallback(
    (message) => {
      if (!isSignalingMessage(message)) {
        console.warn("[signaling] Ignored invalid outbound message", message);
        return false;
      }

      const payload = JSON.stringify(message);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(payload);
        return true;
      }

      if (process.env.NODE_ENV !== "production") {
        console.debug("[signaling mock send]", message);
      }

      return false;
    },
    [notifyHandlers],
  );

  const subscribe = useCallback((handler) => {
    handlersRef.current.add(handler);
    return () => handlersRef.current.delete(handler);
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus(SIGNALING_STATUS.DISCONNECTED);
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !url || typeof WebSocket === "undefined") {
      setStatus(SIGNALING_STATUS.DISCONNECTED);
      return;
    }

    disconnect();
    setStatus(SIGNALING_STATUS.CONNECTING);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus(SIGNALING_STATUS.CONNECTED);
    };

    ws.onmessage = (event) => {
      try {
        const message = parseSignalingMessage(event.data);
        if (isSignalingMessage(message)) {
          notifyHandlers(message);
        }
      } catch (error) {
        console.warn("[signaling] Failed to parse inbound message", error);
      }
    };

    ws.onerror = () => {
      setStatus(SIGNALING_STATUS.ERROR);
    };

    ws.onclose = () => {
      wsRef.current = null;
      setStatus(SIGNALING_STATUS.DISCONNECTED);

      if (enabled && url) {
        reconnectTimerRef.current = setTimeout(connect, 3000);
      }
    };
  }, [disconnect, enabled, notifyHandlers, url]);

  useEffect(() => {
    if (!enabled || !url) {
      disconnect();
      return undefined;
    }

    connect();
    return disconnect;
  }, [connect, disconnect, enabled, url]);

  return {
    status,
    isConnected: status === SIGNALING_STATUS.CONNECTED,
    isMockMode: !url,
    send,
    subscribe,
    connect,
    disconnect,
  };
}
