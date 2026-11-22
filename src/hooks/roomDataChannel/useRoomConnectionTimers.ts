import type { DataConnection } from "peerjs";
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from "react";
import type { PeerJsConfig } from "@/lib/room/roomTypes";
import type { AudienceMediaController } from "@/lib/webrtc/AudienceMediaController";
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
} from "@/lib/webrtc/peerClient";
import { clearWindowTimer } from "@/lib/webrtc/roomConnectionLifecycle";

const CONNECT_RETRY_MS = 2000;

export function useRoomConnectionTimers({
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
}: {
  isHost: boolean;
  destroyedRef: MutableRefObject<boolean>;
  audienceRef: MutableRefObject<AudienceMediaController | null>;
  roomIdRef: MutableRefObject<string | null | undefined>;
  hostConnectionRef: MutableRefObject<DataConnection | null>;
  openCountRef: MutableRefObject<number>;
  signalingOpenRef: MutableRefObject<boolean>;
  peerConfigRef: MutableRefObject<PeerJsConfig | null>;
  onRemoteHostStreamRef: MutableRefObject<
    ((stream: MediaStream | null) => void) | null
  >;
  setHostPresent: Dispatch<SetStateAction<boolean>>;
  setConnectionError: Dispatch<SetStateAction<string | null>>;
}) {
  const hostPresentTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const connectRetryTimerRef = useRef<number | null>(null);
  const connectToHostRef = useRef<() => void>(() => {});
  const connectTimeoutRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);

  const clearRetryTimer = useCallback(() => {
    clearWindowTimer(retryTimerRef);
  }, []);

  const clearConnectRetryTimer = useCallback(() => {
    clearWindowTimer(connectRetryTimerRef);
  }, []);

  const clearConnectTimeout = useCallback(() => {
    clearWindowTimer(connectTimeoutRef);
  }, []);

  const clearHostPresentTimer = useCallback(() => {
    if (hostPresentTimerRef.current) {
      clearInterval(hostPresentTimerRef.current);
      hostPresentTimerRef.current = null;
    }
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
  }, [
    audienceRef,
    clearConnectRetryTimer,
    destroyedRef,
    hostConnectionRef,
    isHost,
    onRemoteHostStreamRef,
    openCountRef,
    roomIdRef,
    setConnectionError,
    setHostPresent,
  ]);

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
  }, [
    clearConnectTimeout,
    destroyedRef,
    isHost,
    openCountRef,
    setConnectionError,
    signalingOpenRef,
  ]);

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
    [
      clearRetryTimer,
      isHost,
      peerConfigRef,
      scheduleConnectTimeout,
      setConnectionError,
    ],
  );

  return {
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
  };
}
