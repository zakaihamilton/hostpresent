import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
} from "react";
import { DIAGNOSTIC_EVENT } from "@/lib/diagnostics/diagnosticsPayload";
import { reportDiagnostic } from "@/lib/diagnostics/reportDiagnostic";
import {
  normalizeDisplayNameInput,
  PARTICIPANT_MODE,
  saveDisplayName,
  saveParticipantMode,
} from "@/lib/settings/displayNameSettings";
import {
  getRoomTitleByHostToken,
  updateRoomTitle,
} from "@/lib/settings/roomSettings";
import type { ParticipantMode } from "@/lib/signaling/messages";
import {
  createHostFocusChangedMessage,
  createMeetingEndedMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import type { RemoteParticipantsConnection } from "./RemoteParticipants";

export function useMeetingSessionLifecycle({
  isHost,
  token,
  onBack,
  canPublishMedia,
  meetingSeconds,
  isRecording,
  stopRecordingAsync,
  roomConnection,
  roomConnectionRef,
  streamListenerCleanupsRef,
  focusedParticipantId,
  setFocusedParticipantId,
  effectiveFocusedId,
  meetingDisconnectReason,
  setMeetingDisconnectReason,
  setTimersEnabled,
  setDisplayNameInput,
  setSessionTitle,
  setParticipantMode,
  setErrorMsg,
  confirm,
}: {
  isHost: boolean;
  token?: string;
  onBack: () => void;
  canPublishMedia: boolean;
  meetingSeconds: number;
  isRecording: boolean;
  stopRecordingAsync: () => Promise<unknown>;
  roomConnection: RemoteParticipantsConnection & {
    status?: string;
    activeConnectionsCount?: number;
    connectionError?: string | null;
    iceServers?: RTCIceServer[] | null;
    publisherIds?: string[];
  };
  roomConnectionRef: MutableRefObject<RemoteParticipantsConnection | null>;
  streamListenerCleanupsRef: MutableRefObject<Map<string, () => void>>;
  focusedParticipantId: string;
  setFocusedParticipantId: Dispatch<SetStateAction<string>>;
  effectiveFocusedId: string;
  meetingDisconnectReason: "ended" | "full" | "limit_reached" | null;
  setMeetingDisconnectReason: Dispatch<
    SetStateAction<"ended" | "full" | "limit_reached" | null>
  >;
  setTimersEnabled: Dispatch<SetStateAction<boolean>>;
  setDisplayNameInput: Dispatch<SetStateAction<string>>;
  setSessionTitle: Dispatch<SetStateAction<string>>;
  setParticipantMode: Dispatch<SetStateAction<ParticipantMode>>;
  setErrorMsg: Dispatch<SetStateAction<string>>;
  confirm: (options: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    variant: string;
  }) => Promise<unknown>;
}) {
  useEffect(() => {
    if (!isHost)
      setParticipantMode(
        canPublishMedia
          ? PARTICIPANT_MODE.AVAILABLE
          : PARTICIPANT_MODE.LISTENING,
      );
  }, [canPublishMedia, isHost, setParticipantMode]);

  const sendDiagnosticReport = useCallback(() => {
    const hasTurn = Boolean(
      roomConnection?.iceServers?.some((server) =>
        (Array.isArray(server.urls) ? server.urls : [server.urls]).some(
          (url) => url?.startsWith("turn:") || url?.startsWith("turns:"),
        ),
      ),
    );
    return reportDiagnostic({
      event: roomConnection?.connectionError
        ? DIAGNOSTIC_EVENT.CONNECTION_FAILURE
        : DIAGNOSTIC_EVENT.DIAGNOSTICS_REPORT,
      code: roomConnection?.connectionError
        ? "connection_error"
        : "diagnostics_requested",
      details: {
        connectionStatus: roomConnection?.status ?? "unknown",
        activeConnections: roomConnection?.activeConnectionsCount ?? 0,
        hasTurn,
      },
    });
  }, [roomConnection]);

  useEffect(() => {
    if (isHost && token) {
      setSessionTitle(getRoomTitleByHostToken(token));
    }
  }, [isHost, setSessionTitle, token]);

  useEffect(() => {
    document.body.classList.add("in-meeting");
    return () => {
      document.body.classList.remove("in-meeting");
    };
  }, []);

  useEffect(() => {
    if (meetingSeconds >= 21600) {
      const autoEnd = async () => {
        if (isHost) {
          if (isRecording) {
            try {
              await stopRecordingAsync();
            } catch (err) {
              console.error("Failed to stop recording on timeout:", err);
            }
          }
          roomConnectionRef.current?.send(createMeetingEndedMessage());
        }
        roomConnectionRef.current?.disconnect();
        setMeetingDisconnectReason("limit_reached");
      };
      void autoEnd();
    }
  }, [
    meetingSeconds,
    isHost,
    isRecording,
    roomConnectionRef,
    setMeetingDisconnectReason,
    stopRecordingAsync,
  ]);

  useEffect(() => {
    setTimersEnabled(true);
    return () => {
      for (const cleanup of streamListenerCleanupsRef?.current?.values() ??
        []) {
        cleanup?.();
      }
      streamListenerCleanupsRef?.current?.clear();
    };
  }, [setTimersEnabled, streamListenerCleanupsRef]);

  const handleBack = useCallback(() => {
    roomConnection?.disconnect();
    onBack();
  }, [onBack, roomConnection]);

  const handleDisconnectBack = useCallback(() => {
    onBack();
  }, [onBack]);

  const handleDisplayNameChange = useCallback(
    (value: string) => {
      const normalized = normalizeDisplayNameInput(value);
      setDisplayNameInput(normalized);
      saveDisplayName(normalized);
    },
    [setDisplayNameInput],
  );

  const handleSessionTitleChange = useCallback(
    (newTitle: string) => {
      if (isHost && token) {
        setSessionTitle(newTitle);
        updateRoomTitle(token, newTitle);
      }
    },
    [isHost, setSessionTitle, token],
  );

  const handleParticipantModeChange = useCallback(
    (mode: ParticipantMode) => {
      setParticipantMode(mode);
      saveParticipantMode(mode);
    },
    [setParticipantMode],
  );

  const handleFocusParticipant = useCallback(
    (participantId: string) => {
      if (!isHost) return;
      const nextFocusedId =
        participantId === focusedParticipantId ? "" : participantId || "";
      setFocusedParticipantId(nextFocusedId);
      roomConnectionRef.current?.send(
        createHostFocusChangedMessage({ focusedId: nextFocusedId }),
      );
    },
    [focusedParticipantId, isHost, roomConnectionRef, setFocusedParticipantId],
  );

  const handleEndMeeting = useCallback(async () => {
    if (!isHost) return;
    const confirmed = await confirm({
      title: "End meeting",
      message: "All participants will be disconnected. This cannot be undone.",
      confirmLabel: "End meeting",
      cancelLabel: "Cancel",
      variant: "danger",
    });
    if (!confirmed) return;
    if (isRecording) {
      await stopRecordingAsync();
    }
    roomConnectionRef.current?.send(createMeetingEndedMessage());
    roomConnectionRef.current?.disconnect();
    handleBack();
  }, [
    confirm,
    handleBack,
    isHost,
    isRecording,
    roomConnectionRef,
    stopRecordingAsync,
  ]);

  useEffect(() => {
    if (isHost) return undefined;
    return roomConnectionRef.current?.subscribe((message) => {
      if (message.type === SIGNALING_MESSAGE.HOST_FOCUS_CHANGED) {
        setFocusedParticipantId(message.focusedId ?? "host");
      }
    });
  }, [isHost, roomConnectionRef, setFocusedParticipantId]);

  useEffect(() => {
    if (isHost) return undefined;
    if (meetingDisconnectReason) return undefined;
    return roomConnectionRef.current?.subscribe((message) => {
      if (message.type === SIGNALING_MESSAGE.MEETING_ENDED) {
        setMeetingDisconnectReason("ended");
        roomConnectionRef.current?.disconnect();
      }
      if (message.type === SIGNALING_MESSAGE.ROOM_FULL) {
        setMeetingDisconnectReason("full");
        roomConnectionRef.current?.disconnect();
      }
    });
  }, [
    isHost,
    meetingDisconnectReason,
    roomConnectionRef,
    setMeetingDisconnectReason,
  ]);

  useEffect(() => {
    if (!isHost || !focusedParticipantId || focusedParticipantId === "host")
      return;
    if (!roomConnection.publisherIds?.includes(focusedParticipantId)) {
      handleFocusParticipant(focusedParticipantId);
    }
  }, [
    focusedParticipantId,
    handleFocusParticipant,
    isHost,
    roomConnection.publisherIds,
  ]);

  useEffect(() => {
    if (!isHost) return;
    roomConnectionRef.current?.send(
      createHostFocusChangedMessage({ focusedId: effectiveFocusedId }),
    );
  }, [effectiveFocusedId, isHost, roomConnectionRef]);

  const handleDismissError = useCallback(() => {
    setErrorMsg("");
  }, [setErrorMsg]);

  return {
    sendDiagnosticReport,
    handleBack,
    handleDisconnectBack,
    handleDisplayNameChange,
    handleSessionTitleChange,
    handleParticipantModeChange,
    handleFocusParticipant,
    handleEndMeeting,
    handleDismissError,
  };
}
