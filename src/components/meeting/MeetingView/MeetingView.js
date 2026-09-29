"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Recording } from "@/components/meeting/Recording";
import { PeerStreamConnection } from "@/components/webrtc/PeerStreamConnection";
import {
  useConfirmDialog,
  useHostControls,
  useRoomDataChannel,
  useSessionTimers,
} from "@/hooks";
import { useRoomSession } from "@/hooks/roomSession";
import { copyTextToClipboard } from "@/lib/clipboard";
import { DIAGNOSTIC_EVENT } from "@/lib/diagnostics/diagnosticsPayload";
import { reportDiagnostic } from "@/lib/diagnostics/reportDiagnostic";
import { buildParticipantInviteLink } from "@/lib/room/inviteLink";
import { formatJoinCode, isValidJoinCode } from "@/lib/room/joinCodeFormat";
import {
  loadDisplayName,
  loadParticipantMode,
  normalizeDisplayNameInput,
  PARTICIPANT_MODE,
  resolveDisplayName,
  saveDisplayName,
  saveParticipantMode,
} from "@/lib/settings/displayNameSettings";
import {
  getRoomTitleByHostToken,
  updateRoomTitle,
} from "@/lib/settings/roomSettings";
import {
  createHostFocusChangedMessage,
  createMeetingEndedMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import {
  hostPeerId,
  isFatalSignalingError,
  isSignalingConfigError,
  isWaitingForHostMessage,
} from "@/lib/webrtc/peerClient";
import { getAutoFocusTargetId } from "./autoFocus";
import { MeetingControls } from "./components/MeetingControls";
import { MeetingHeaderArea } from "./components/MeetingHeaderArea";
import { MeetingWorkspace } from "./components/MeetingWorkspace";
import { MediaControls } from "./hooks/MediaControls";
import {
  attachSpeakingDetector,
  RemoteParticipants,
} from "./hooks/RemoteParticipants";
import { useMeetingLayoutState } from "./hooks/useMeetingLayoutState";
import { useMeetingViewModels } from "./hooks/useMeetingViewModels";
import styles from "./MeetingView.module.css";
import { getMeetingStatusScreen } from "./meetingStatusScreen";

export function MeetingView({ token, ...props }) {
  const {
    status: sessionStatus,
    roomState,
    error: sessionError,
  } = useRoomSession({
    role: props.role,
    token,
    enabled: Boolean(token),
  });

  return (
    <PeerStreamConnection
      peerAuthToken={roomState?.peerAuthToken}
      iceConfigUrl={roomState?.iceConfigUrl}
      sessionError={sessionError}
    >
      <MeetingViewInner
        token={token}
        {...props}
        sessionStatus={sessionStatus}
        roomState={roomState}
        sessionError={sessionError}
      />
    </PeerStreamConnection>
  );
}

function MeetingViewInner({
  role,
  token,
  joinCode: routeJoinCode,
  onBack,
  sessionStatus,
  roomState,
  sessionError,
}) {
  const isHost = role === "host";
  const roomConnectionRef = useRef(null);
  const onRemoteParticipantRef = useRef(null);
  const onRemoteHostStreamRef = useRef(null);
  const onChatMessageRef = useRef(null);

  const roomJoinCode = routeJoinCode ?? roomState?.joinCode ?? "";
  const formattedRoomId = useMemo(
    () => (isValidJoinCode(roomJoinCode) ? formatJoinCode(roomJoinCode) : ""),
    [roomJoinCode],
  );
  const inviteLink = useMemo(
    () =>
      isHost && formattedRoomId ? buildParticipantInviteLink(roomJoinCode) : "",
    [isHost, formattedRoomId, roomJoinCode],
  );

  const [inviteBarVisible, setInviteBarVisible] = useState(false);
  const [inviteCopyMessage, setInviteCopyMessage] = useState("");
  const layout = useMeetingLayoutState();
  const {
    isGalleryVisible,
    isSidebarVisible,
    isPipVisible,
    isChatVisible,
    hasUnreadChat,
    isMobile,
    setHasUnreadChat,
  } = layout;
  const [chatMessages, setChatMessages] = useState([]);
  const chatIdCounterRef = useRef(0);
  const [timersEnabled, setTimersEnabled] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(() =>
    loadDisplayName(),
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [participantMode, setParticipantMode] = useState(() =>
    loadParticipantMode(),
  );
  const canPublishMedia =
    isHost || participantMode !== PARTICIPANT_MODE.LISTENING;
  const [sessionTitle, setSessionTitle] = useState("");
  const [focusedParticipantId, setFocusedParticipantId] = useState("");
  const [meetingDisconnectReason, setMeetingDisconnectReason] = useState(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const resolvedDisplayName = useMemo(
    () => resolveDisplayName(displayNameInput),
    [displayNameInput],
  );
  const inviteCopyTimerRef = useRef(null);

  const { meetingSeconds, recordingSeconds, resetRecordingTimer } =
    useSessionTimers({
      isRecording,
      isRecordingPaused,
      enabled: timersEnabled,
    });

  const { confirm, dialogProps } = useConfirmDialog();

  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [localIsSpeaking, setLocalIsSpeaking] = useState(false);
  const localSpeakingCleanupRef = useRef(null);

  useEffect(() => {
    localSpeakingCleanupRef.current?.();
    localSpeakingCleanupRef.current = null;
    setLocalIsSpeaking(false);

    if (localStream) {
      localSpeakingCleanupRef.current = attachSpeakingDetector(
        localStream,
        setLocalIsSpeaking,
      );
    }

    return () => {
      localSpeakingCleanupRef.current?.();
      localSpeakingCleanupRef.current = null;
    };
  }, [localStream]);

  const onRemoteParticipant = useCallback(
    (arg) => onRemoteParticipantRef.current?.(arg),
    [],
  );
  const onRemoteHostStream = useCallback(
    (arg) => onRemoteHostStreamRef.current?.(arg),
    [],
  );
  const onChatMessage = useCallback(
    (message) => onChatMessageRef.current?.(message),
    [],
  );

  const roomConnection = useRoomDataChannel({
    role,
    token,
    peerAuthToken: roomState?.peerAuthToken,
    peerId: roomState?.peerId,
    roomId: roomState?.roomId ?? null,
    enabled: Boolean(token && roomState?.roomId && !meetingDisconnectReason),
    displayName: resolvedDisplayName,
    hostAudioMuted: false,
    hostVideoMuted: false,
    hostMode: isHost ? participantMode : undefined,
    participantMode: isHost ? undefined : participantMode,
    localStream,
    screenStream,
    onRemoteParticipant,
    onRemoteHostStream: isHost ? undefined : onRemoteHostStream,
    onChatMessage,
    sessionTitle,
  });

  roomConnectionRef.current = roomConnection;

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

  onChatMessageRef.current = (message) => {
    const localId = isHost
      ? roomState?.roomId
        ? hostPeerId(roomState.roomId)
        : ""
      : (roomConnectionRef.current?.localParticipantId ?? "");
    const isSelf = message.senderId === localId;
    const id = `${message.timestamp}-${message.senderId}-${chatIdCounterRef.current}`;
    chatIdCounterRef.current += 1;
    setChatMessages((previous) => [
      ...previous,
      {
        id,
        senderId: message.senderId,
        senderName: message.senderName || "Guest",
        text: message.text,
        timestamp: message.timestamp,
        isPrivate: message.type === SIGNALING_MESSAGE.CHAT_PRIVATE_MESSAGE,
        recipientId: message.recipientId,
        isSelf,
      },
    ]);
    if (!isChatVisible) {
      setHasUnreadChat(true);
    }
  };

  useEffect(() => {
    if (isChatVisible) {
      setHasUnreadChat(false);
    }
  }, [isChatVisible, setHasUnreadChat]);

  const handleSendChatMessage = useCallback((text, recipientId) => {
    if (recipientId) {
      roomConnectionRef.current?.sendPrivateChatMessage(text, recipientId);
    } else {
      roomConnectionRef.current?.sendChatMessage(text);
    }
  }, []);

  const {
    isAudioMuted,
    isVideoMuted,
    errorMsg,
    setErrorMsg,
    shareScreenAudio,
    isScreenAudioShared,
    publishParticipantMediaStatus,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    setShareScreenAudioPreference,
    setIsAudioMuted,
    setIsVideoMuted,
    availableCameras,
    selectedCamera,
    switchCamera,
    availableMicrophones,
    selectedMicrophone,
    switchMicrophone,
    isVoiceIsolationEnabled,
    isVoiceIsolationChanging,
    setVoiceIsolation,
    availableSpeakers,
    selectedSpeaker,
    switchSpeaker,
  } = MediaControls({
    isHost,
    participantMode,
    roomConnection,
    localStream,
    setLocalStream,
    screenStream,
    setScreenStream,
  });

  const {
    videoParticipants,
    setVideoParticipants,
    peerParticipants,
    hostStream,
    hostStreamPlaybackMuted,
    hostDisplayName,
    hostAudioMuted,
    hostVideoMuted,
    hostScreenSharing,
    hostIsSpeaking,
    hostMode,
    hostPresent,
    audioList,
    setAudioList,
    streamListenerCleanupsRef,
    handleRemoteParticipant,
    handleRemoteHostStream,
  } = RemoteParticipants({
    isHost,
    roomConnectionRef,
    roomConnection,
    localStream,
    screenStream,
    isAudioMuted,
    isVideoMuted,
    setIsAudioMuted,
    setIsVideoMuted,
    setIsRecording,
    setIsRecordingPaused,
    resetRecordingTimer,
    publishParticipantMediaStatus,
    setSessionTitle,
  });

  onRemoteParticipantRef.current = handleRemoteParticipant;
  onRemoteHostStreamRef.current = handleRemoteHostStream;

  const AUTO_FOCUS_INACTIVITY_MS = 3000;

  const autoFocusTargetId = useMemo(
    () =>
      getAutoFocusTargetId({
        focusedParticipantId,
        videoParticipants,
        isHost,
        localIsSpeaking,
        localVideoAvailable: Boolean(screenStream) || !isVideoMuted,
        hostIsSpeaking,
        hostVideoAvailable: hostScreenSharing || !hostVideoMuted,
        hostIsScreenSharing: isHost ? Boolean(screenStream) : hostScreenSharing,
      }),
    [
      focusedParticipantId,
      videoParticipants,
      isHost,
      localIsSpeaking,
      screenStream,
      isVideoMuted,
      hostIsSpeaking,
      hostScreenSharing,
      hostVideoMuted,
    ],
  );

  const [effectiveFocusedId, setEffectiveFocusedId] = useState(
    focusedParticipantId || "host",
  );
  const hostIsActivelySpeaking = isHost ? localIsSpeaking : hostIsSpeaking;

  useEffect(() => {
    if (focusedParticipantId !== "") {
      setEffectiveFocusedId(focusedParticipantId);
      return undefined;
    }

    // A host who starts speaking should take the stage immediately. Keep the
    // brief inactivity delay only for the no-one-is-speaking fallback, so the
    // stage does not jump back to the host between short pauses.
    if (autoFocusTargetId !== "host" || hostIsActivelySpeaking) {
      setEffectiveFocusedId(autoFocusTargetId);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setEffectiveFocusedId(autoFocusTargetId);
    }, AUTO_FOCUS_INACTIVITY_MS);

    return () => window.clearTimeout(timer);
  }, [focusedParticipantId, autoFocusTargetId, hostIsActivelySpeaking]);

  const {
    downloadState,
    savedRecording,
    canResumeSavedRecording,
    dismissDownloadBanner,
    downloadSavedRecording,
    resumeSavedRecording,
    discardSavedRecording,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    stopRecordingAsync,
  } = Recording({
    isHost,
    roomConnection,
    localStream,
    screenStream,
    videoParticipants,
    focusedParticipantId: effectiveFocusedId,
    resetRecordingTimer,
    isRecording,
    setIsRecording,
    isRecordingPaused,
    setIsRecordingPaused,
    sessionName: sessionTitle,
  });

  const {
    muteParticipantAudio,
    muteParticipantVideo,
    muteAllAudio,
    muteAllVideo,
    canMuteAllAudio,
    canMuteAllVideo,
  } = useHostControls({
    videoParticipants,
    audioList,
    setVideoParticipants,
    setAudioList,
    signaling: roomConnection,
    confirm,
    enabled: isHost,
  });

  useEffect(() => {
    if (isHost && token) {
      setSessionTitle(getRoomTitleByHostToken(token));
    }
  }, [isHost, token]);

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
      autoEnd();
    }
  }, [meetingSeconds, isHost, isRecording, stopRecordingAsync]);

  useEffect(() => {
    setTimersEnabled(true);
    return () => {
      for (const cleanup of streamListenerCleanupsRef?.current?.values() ??
        []) {
        cleanup?.();
      }
      streamListenerCleanupsRef?.current?.clear();
      if (inviteCopyTimerRef.current) {
        clearTimeout(inviteCopyTimerRef.current);
      }
    };
  }, [
    streamListenerCleanupsRef?.current?.clear,
    streamListenerCleanupsRef?.current?.values,
  ]);

  const fatalConnectionError =
    roomConnection?.connectionError &&
    isFatalSignalingError(roomConnection.connectionError)
      ? roomConnection.connectionError
      : null;
  const signalingConfigError =
    fatalConnectionError && isSignalingConfigError(fatalConnectionError)
      ? fatalConnectionError
      : null;

  const handleBack = useCallback(() => {
    roomConnection?.disconnect();
    onBack();
  }, [onBack, roomConnection?.disconnect]);

  const handleDisconnectBack = useCallback(() => {
    onBack();
  }, [onBack]);

  const handleDisplayNameChange = useCallback((value) => {
    const normalized = normalizeDisplayNameInput(value);
    setDisplayNameInput(normalized);
    saveDisplayName(normalized);
  }, []);

  const handleSessionTitleChange = useCallback(
    (newTitle) => {
      if (isHost && token) {
        setSessionTitle(newTitle);
        updateRoomTitle(token, newTitle);
      }
    },
    [isHost, token],
  );

  const handleParticipantModeChange = useCallback((mode) => {
    setParticipantMode(mode);
    saveParticipantMode(mode);
  }, []);

  const handleFocusParticipant = useCallback(
    (participantId) => {
      if (!isHost) return;
      const nextFocusedId =
        participantId === focusedParticipantId ? "" : participantId || "";
      setFocusedParticipantId(nextFocusedId);
      roomConnectionRef.current?.send(
        createHostFocusChangedMessage({ focusedId: nextFocusedId }),
      );
    },
    [isHost, focusedParticipantId],
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
  }, [confirm, isHost, isRecording, stopRecordingAsync, handleBack]);

  useEffect(() => {
    if (isHost) return undefined;
    return roomConnectionRef.current?.subscribe((message) => {
      if (message.type === SIGNALING_MESSAGE.HOST_FOCUS_CHANGED) {
        setFocusedParticipantId(message.focusedId ?? "host");
      }
    });
  }, [isHost]);

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
  }, [isHost, meetingDisconnectReason]);

  useEffect(() => {
    if (!isHost || !focusedParticipantId || focusedParticipantId === "host")
      return;
    if (
      !videoParticipants.some(
        (participant) => participant.id === focusedParticipantId,
      )
    ) {
      handleFocusParticipant(focusedParticipantId);
    }
  }, [focusedParticipantId, handleFocusParticipant, isHost, videoParticipants]);

  useEffect(() => {
    if (!isHost) return;
    roomConnectionRef.current?.send(
      createHostFocusChangedMessage({ focusedId: effectiveFocusedId }),
    );
  }, [isHost, effectiveFocusedId]);

  const handleShowInviteBar = useCallback(() => {
    setInviteBarVisible(true);
  }, []);

  const handleDismissInviteBar = useCallback(() => {
    setInviteBarVisible(false);
  }, []);

  const handleDismissError = useCallback(() => {
    setErrorMsg("");
  }, [setErrorMsg]);

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;

    if (inviteCopyTimerRef.current) {
      clearTimeout(inviteCopyTimerRef.current);
    }

    const copied = await copyTextToClipboard(inviteLink);
    setInviteCopyMessage(copied ? "Copied!" : "Copy failed");

    inviteCopyTimerRef.current = setTimeout(() => {
      setInviteCopyMessage("");
      inviteCopyTimerRef.current = null;
    }, 2500);
  };

  const { chatParticipants, galleryParticipants, primaryViewProps } =
    useMeetingViewModels({
      isHost,
      videoParticipants,
      audioList,
      peerParticipants,
      hostDisplayName,
      effectiveFocusedId,
      roomConnection,
      hostStream,
      hostAudioMuted,
      hostVideoMuted,
      hostScreenSharing,
      hostIsSpeaking,
      hostStreamPlaybackMuted,
      localStream,
      screenStream,
      isScreenAudioShared,
      isAudioMuted,
      resolvedDisplayName,
    });

  const statusScreen = getMeetingStatusScreen({
    sessionStatus,
    sessionError,
    handleBack,
    handleDisconnectBack,
    signalingConfigError,
    meetingDisconnectReason,
    fatalConnectionError,
    isHost,
  });
  if (statusScreen) return statusScreen;

  return (
    <div className={styles.app}>
      <MeetingHeaderArea
        isRecording={isRecording}
        isRecordingPaused={isRecordingPaused}
        headerProps={{
          meetingDurationSeconds: meetingSeconds,
          roomId: formattedRoomId || null,
          sessionTitle: sessionTitle || null,
          isRecording,
          isRecordingPaused,
          recordingDurationSeconds: recordingSeconds,
          onShowInviteLink:
            isHost && inviteLink && !inviteBarVisible
              ? handleShowInviteBar
              : null,
          onSessionTitleChange: isHost ? handleSessionTitleChange : null,
          revealTitleOnLogoClick: !isHost,
          showRecording: isHost,
          onStartRecording: startRecording,
          onPauseRecording: pauseRecording,
          onResumeRecording: resumeRecording,
          onStopRecording: stopRecording,
        }}
        connectionProps={{
          isHost,
          hostPresent,
          connectionError: roomConnection?.connectionError,
          activeConnectionsCount: roomConnection?.activeConnectionsCount ?? 0,
          isWaitingForHost: isWaitingForHostMessage(
            roomConnection?.connectionError,
          ),
          isFatalConnectionError: fatalConnectionError,
        }}
        inviteProps={{
          visible: Boolean(isHost && inviteLink && inviteBarVisible),
          inviteLink,
          inviteCopyMessage,
          onCopyInviteLink: handleCopyInviteLink,
          onDismiss: handleDismissInviteBar,
          roomId: formattedRoomId,
        }}
      />

      <MeetingWorkspace
        chatPanelProps={{
          messages: chatMessages,
          participants: chatParticipants,
          onSendMessage: handleSendChatMessage,
          sessionName: sessionTitle,
        }}
        downloadState={downloadState}
        errorMessage={errorMsg}
        galleryProps={{
          visible: isGalleryVisible,
          screenStream,
          localStream,
          isAudioMuted,
          isVideoMuted,
          isScreenSharing: Boolean(screenStream),
          localDisplayName: resolvedDisplayName,
          localIsSpeaking,
          audioOutputDeviceId: selectedSpeaker,
          focusedParticipantId: effectiveFocusedId,
          manualFocusedId: focusedParticipantId,
          allowFocus: isHost,
          onFocusParticipant: handleFocusParticipant,
          connectionStatus: roomConnection?.status,
        }}
        isChatVisible={isChatVisible}
        isMobile={isMobile}
        isPipVisible={isPipVisible}
        isSidebarVisible={isSidebarVisible}
        localStream={localStream}
        onCloseChat={layout.closeChat}
        onClosePanels={layout.closePanels}
        onCloseSidebar={layout.closeSidebar}
        onDismissDownload={dismissDownloadBanner}
        onDismissError={handleDismissError}
        onShowDiagnostics={() => setIsDiagnosticsOpen(true)}
        participantSidebarProps={{
          audioList,
          videoParticipants,
          peerParticipants,
          hostDisplayName,
          hostIsAudioMuted: hostAudioMuted,
          hostIsVideoMuted: hostVideoMuted,
          hostIsSpeaking,
          hostMode,
          isVideoMuted,
          isAudioMuted,
          isHost,
          localDisplayName: displayNameInput,
          localParticipantMode: participantMode,
          focusedParticipantId,
          localIsSpeaking,
          localIsScreenSharing: Boolean(screenStream),
          hostIsScreenSharing: hostScreenSharing,
          connectionStatus: roomConnection?.status,
          onFocusParticipant: handleFocusParticipant,
          onMuteParticipantVideo: muteParticipantVideo,
          onMuteParticipantAudio: muteParticipantAudio,
          onMuteAllVideo: muteAllVideo,
          onMuteAllAudio: muteAllAudio,
          canMuteAllVideo,
          canMuteAllAudio,
        }}
        pipProps={{
          stream: localStream,
          isVideoMuted,
          name: resolvedDisplayName,
          initial: resolvedDisplayName?.charAt(0),
        }}
        primaryViewProps={{
          ...primaryViewProps,
          isScreenSharing: Boolean(screenStream),
          onStopScreenShare: screenStream ? toggleScreenShare : null,
          isRecording,
          isRecordingPaused,
          recordingDurationSeconds: recordingSeconds,
          audioOutputDeviceId: selectedSpeaker,
          connectionStatus:
            effectiveFocusedId === "host" ||
            (!isHost &&
              effectiveFocusedId === roomConnection?.localParticipantId)
              ? roomConnection?.status
              : null,
        }}
        recording={{
          canResume: canResumeSavedRecording,
          onResume: resumeSavedRecording,
          onDownload: downloadSavedRecording,
          onDiscard: discardSavedRecording,
        }}
        savedRecording={savedRecording}
        videoParticipants={galleryParticipants}
      />

      <MeetingControls
        confirmDialogProps={dialogProps}
        diagnosticsProps={{
          isOpen: isDiagnosticsOpen,
          onClose: () => setIsDiagnosticsOpen(false),
          role,
          roomId: formattedRoomId || null,
          connectionStatus: roomConnection?.status,
          localParticipantId: roomConnection?.localParticipantId,
          peerConfig: roomConnection?.peerConfig,
          iceServers: roomConnection?.iceServers,
          activeConnectionsCount: roomConnection?.activeConnectionsCount,
          connectionError: roomConnection?.connectionError,
          onReconnect: roomConnection?.reconnect,
          onSendDiagnosticReport: sendDiagnosticReport,
          isTurnActive: roomConnection?.isTurnActive,
        }}
        toolbarProps={{
          isAudioMuted,
          isVideoMuted,
          screenStream,
          shareScreenAudio,
          isScreenAudioShared,
          isGalleryVisible,
          isSidebarVisible,
          isPipVisible,
          isChatVisible,
          hasUnreadChat,
          displayName: displayNameInput,
          onDisplayNameChange: handleDisplayNameChange,
          participantMode,
          onParticipantModeChange: handleDisplayNameChange
            ? handleParticipantModeChange
            : null,
          availableMicrophones,
          selectedMicrophone,
          onMicrophoneChange: switchMicrophone,
          isVoiceIsolationEnabled,
          isVoiceIsolationChanging,
          onVoiceIsolationChange: setVoiceIsolation,
          availableSpeakers,
          selectedSpeaker,
          onSpeakerChange: switchSpeaker,
          availableCameras,
          selectedCamera,
          onCameraChange: switchCamera,
          onToggleAudio: toggleAudio,
          onToggleVideo: toggleVideo,
          onToggleScreenShare: toggleScreenShare,
          onShareScreenAudioChange: setShareScreenAudioPreference,
          onToggleGallery: layout.toggleGallery,
          onToggleSidebar: layout.toggleSidebar,
          onTogglePip: layout.togglePip,
          onToggleChat: layout.toggleChat,
          isHost,
          onEndMeeting: handleEndMeeting,
          onLeave: handleBack,
          participantCount: isHost
            ? 1 + videoParticipants.length + audioList.length
            : 2 + peerParticipants.length,
          mediaPublishingEnabled: canPublishMedia,
          allowScreenShare: canPublishMedia,
        }}
      />
    </div>
  );
}
