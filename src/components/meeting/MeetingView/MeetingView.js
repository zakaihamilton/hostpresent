"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/meeting/ChatPanel";
import { ConnectionBanner } from "@/components/meeting/ConnectionBanner/ConnectionBanner";
import { Header } from "@/components/meeting/Header";
import { InviteBar } from "@/components/meeting/InviteBar/InviteBar";
import { ParticipantsSidebar } from "@/components/meeting/ParticipantsSidebar";
import { PipView } from "@/components/meeting/PipView";
import { PrimaryView } from "@/components/meeting/PrimaryView";
import { Toolbar } from "@/components/meeting/Toolbar";
import { VideoGallery } from "@/components/meeting/VideoGallery";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { MeetingJoinError } from "@/components/ui/MeetingJoinError";
import { MeetingLoading } from "@/components/ui/MeetingLoading";
import { RecordingDownloadBanner } from "@/components/ui/RecordingDownloadBanner";
import { PeerStreamConnection } from "@/components/webrtc/PeerStreamConnection";
import {
  useConfirmDialog,
  useHostControls,
  useRoomDataChannel,
  useSessionTimers,
} from "@/hooks";
import { ROOM_SESSION_STATUS, useRoomSession } from "@/hooks/roomSession";
import { copyTextToClipboard } from "@/lib/clipboard";
import { buildParticipantInviteLink } from "@/lib/room/inviteLink";
import { formatJoinCode } from "@/lib/room/joinCodeFormat";
import {
  loadDisplayName,
  loadParticipantMode,
  normalizeDisplayNameInput,
  resolveDisplayName,
  saveDisplayName,
  saveParticipantMode,
} from "@/lib/settings/displayNameSettings";
import {
  loadGalleryVisible,
  loadSidebarVisible,
  loadChatVisible,
  saveGalleryVisible,
  saveSidebarVisible,
  saveChatVisible,
} from "@/lib/settings/layoutSettings";
import {
  getRoomTitleByHostToken,
  updateRoomTitle,
} from "@/lib/settings/roomSettings";
import {
  createHostFocusChangedMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import { attachSpeakingDetector } from "./hooks/RemoteParticipants";
import {
  getSignalingConfigHint,
  getSignalingErrorHint,
  hostPeerId,
  isFatalSignalingError,
  isSignalingConfigError,
  isWaitingForHostMessage,
} from "@/lib/webrtc/peerClient";
import { MediaControls } from "./hooks/MediaControls";
import { Recording } from "./hooks/Recording";
import { RemoteParticipants } from "./hooks/RemoteParticipants";
import styles from "./MeetingView.module.css";

export function MeetingView({ token, ...props }) {
  return (
    <PeerStreamConnection sessionToken={token}>
      <MeetingViewInner token={token} {...props} />
    </PeerStreamConnection>
  );
}

function MeetingViewInner({ role, token, joinCode: routeJoinCode, onBack }) {
  const isHost = role === "host";
  const roomConnectionRef = useRef(null);
  const onRemoteParticipantRef = useRef(null);
  const onRemoteHostStreamRef = useRef(null);
  const onChatMessageRef = useRef(null);

  const {
    status: sessionStatus,
    roomState,
    error: sessionError,
  } = useRoomSession({ role, token, enabled: Boolean(token) });

  const formattedRoomId = useMemo(
    () => formatJoinCode(routeJoinCode ?? roomState?.joinCode ?? ""),
    [routeJoinCode, roomState?.joinCode],
  );

  const inviteLink = useMemo(
    () =>
      isHost && formattedRoomId
        ? buildParticipantInviteLink(routeJoinCode ?? roomState?.joinCode ?? "")
        : "",
    [isHost, formattedRoomId, routeJoinCode, roomState?.joinCode],
  );

  const [inviteBarVisible, setInviteBarVisible] = useState(false);
  const [inviteCopyMessage, setInviteCopyMessage] = useState("");
  const [isGalleryVisible, setIsGalleryVisible] = useState(() =>
    loadGalleryVisible(),
  );
  const [isSidebarVisible, setIsSidebarVisible] = useState(() =>
    loadSidebarVisible(),
  );
  const [isPipVisible, setIsPipVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(() => loadChatVisible());
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarVisible((sideOpen) => {
          if (sideOpen) {
            setIsChatVisible(false);
          }
          return sideOpen;
        });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  useEffect(() => {
    saveGalleryVisible(isGalleryVisible);
  }, [isGalleryVisible]);
  useEffect(() => {
    saveSidebarVisible(isSidebarVisible);
  }, [isSidebarVisible]);
  useEffect(() => {
    saveChatVisible(isChatVisible);
  }, [isChatVisible]);
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
  const [sessionTitle, setSessionTitle] = useState("");
  const [focusedParticipantId, setFocusedParticipantId] = useState("host");

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
    roomId: roomState?.roomId ?? null,
    enabled: Boolean(token && roomState?.roomId),
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
  }, [isChatVisible]);

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
    availableSpeakers,
    selectedSpeaker,
    switchSpeaker,
  } = MediaControls({
    isHost,
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
    isRecording,
    isRecordingPaused,
    setSessionTitle,
  });

  onRemoteParticipantRef.current = handleRemoteParticipant;
  onRemoteHostStreamRef.current = handleRemoteHostStream;

  const effectiveFocusedId = useMemo(() => {
    if (focusedParticipantId !== "") return focusedParticipantId;
    const speaker = videoParticipants.find((p) => p.isSpeaking);
    if (speaker) return speaker.id;
    if (isHost && localIsSpeaking) return "host";
    if (!isHost && hostIsSpeaking) return "host";
    return "host";
  }, [
    focusedParticipantId,
    videoParticipants,
    isHost,
    localIsSpeaking,
    hostIsSpeaking,
  ]);

  const {
    downloadState,
    savedRecording,
    dismissDownloadBanner,
    downloadSavedRecording,
    discardSavedRecording,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = Recording({
    isHost,
    roomConnection,
    localStream,
    screenStream,
    videoParticipants,
    focusedParticipantId: effectiveFocusedId,
    resetRecordingTimer,
    videoParticipantsLength: videoParticipants.length,
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
  }, []);

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
        participantId === focusedParticipantId ? "" : (participantId || "");
      setFocusedParticipantId(nextFocusedId);
      roomConnectionRef.current?.send(
        createHostFocusChangedMessage({ focusedId: nextFocusedId }),
      );
    },
    [isHost, focusedParticipantId],
  );

  useEffect(() => {
    if (isHost) return undefined;
    return roomConnectionRef.current?.subscribe((message) => {
      if (message.type === SIGNALING_MESSAGE.HOST_FOCUS_CHANGED) {
        setFocusedParticipantId(message.focusedId ?? "host");
      }
    });
  }, [isHost]);

  useEffect(() => {
    if (!isHost || !focusedParticipantId || focusedParticipantId === "host") return;
    if (
      !videoParticipants.some(
        (participant) => participant.id === focusedParticipantId,
      )
    ) {
      handleFocusParticipant(focusedParticipantId);
    }
  }, [focusedParticipantId, handleFocusParticipant, isHost, videoParticipants]);

  const handleToggleGallery = useCallback(() => {
    setIsGalleryVisible((v) => !v);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarVisible((v) => {
      const next = !v;
      if (next && typeof window !== "undefined" && window.innerWidth <= 900) {
        setIsChatVisible(false);
      }
      return next;
    });
  }, []);

  const handleTogglePip = useCallback(() => {
    setIsPipVisible((v) => !v);
  }, []);

  const handleToggleChat = useCallback(() => {
    setIsChatVisible((v) => {
      const next = !v;
      if (next && typeof window !== "undefined" && window.innerWidth <= 900) {
        setIsSidebarVisible(false);
      }
      return next;
    });
  }, []);

  const handleShowInviteBar = useCallback(() => {
    setInviteBarVisible(true);
  }, []);

  const handleDismissInviteBar = useCallback(() => {
    setInviteBarVisible(false);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarVisible(false);
  }, []);

  const handleCloseChat = useCallback(() => {
    setIsChatVisible(false);
  }, []);

  const handleDismissError = useCallback(() => {
    setErrorMsg("");
  }, []);

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

  const chatParticipants = useMemo(() => {
    const list = [];
    if (isHost) {
      for (const p of videoParticipants) {
        list.push({ id: p.id, name: p.name || "Guest" });
      }
      for (const p of audioList) {
        list.push({ id: p.id, name: p.name || "Guest" });
      }
    } else {
      if (hostDisplayName) {
        list.push({ id: "host", name: hostDisplayName });
      }
      for (const p of peerParticipants) {
        list.push({ id: p.id, name: p.name || "Guest" });
      }
    }
    return list;
  }, [isHost, videoParticipants, audioList, hostDisplayName, peerParticipants]);

  const galleryParticipants = useMemo(() => {
    if (isHost) {
      return videoParticipants;
    }

    const nameById = new Map(
      peerParticipants.map((participant) => [participant.id, participant.name]),
    );
    const localId = roomConnection?.localParticipantId;
    const tiles = [];

    if (hostStream) {
      tiles.push({
        id: "host",
        name: hostDisplayName,
        stream: hostStream,
        isAudioMuted: hostAudioMuted,
        isVideoMuted: hostVideoMuted,
        isScreenSharing: hostScreenSharing,
        isSpeaking: hostIsSpeaking,
        avatarColor: "#6366f1",
      });
    }

    for (const participant of videoParticipants) {
      if (participant.id === localId) continue;
      tiles.push({
        ...participant,
        name: nameById.get(participant.id) || participant.name,
      });
    }

    if (localStream) {
      tiles.push({
        id: localId || "self",
        name: resolvedDisplayName,
        stream: localStream,
        isSelf: true,
        isAudioMuted,
        isVideoMuted,
        isSpeaking: localIsSpeaking,
        isScreenSharing: Boolean(screenStream),
        avatarColor: "#3b82f6",
      });
    }

    return tiles;
  }, [
    hostAudioMuted,
    hostDisplayName,
    hostIsSpeaking,
    hostStream,
    hostVideoMuted,
    hostScreenSharing,
    isAudioMuted,
    isHost,
    isVideoMuted,
    localIsSpeaking,
    localStream,
    peerParticipants,
    resolvedDisplayName,
    roomConnection?.localParticipantId,
    screenStream,
    videoParticipants,
  ]);

  const primaryViewProps = useMemo(() => {
    const focusedParticipant =
      effectiveFocusedId && effectiveFocusedId !== "host"
        ? videoParticipants.find(
            (participant) => participant.id === effectiveFocusedId,
          )
        : null;
    const focusedIsSelf =
      !isHost &&
      effectiveFocusedId &&
      effectiveFocusedId === roomConnection?.localParticipantId;
    const viewingFocusedParticipant = Boolean(
      focusedParticipant || focusedIsSelf,
    );
    const viewingHostStream =
      !viewingFocusedParticipant && !isHost && Boolean(hostStream);
    const activeMain = focusedIsSelf
      ? screenStream || localStream
      : focusedParticipant?.stream || screenStream || localStream;
    return {
      stream: viewingHostStream ? hostStream : activeMain,
      label: viewingFocusedParticipant
        ? focusedIsSelf
          ? screenStream
            ? "You are sharing your screen"
            : resolvedDisplayName
          : focusedParticipant.isScreenSharing
            ? `${focusedParticipant.name} is sharing a screen`
            : focusedParticipant.name
        : viewingHostStream
          ? hostScreenSharing
            ? `${hostDisplayName} is sharing a screen`
            : hostDisplayName
          : screenStream
            ? isScreenAudioShared
              ? "You are sharing your screen with audio"
              : "You are sharing your screen"
            : resolvedDisplayName,
      isMuted: viewingHostStream
        ? hostStreamPlaybackMuted
        : focusedParticipant
          ? focusedParticipant.isSelf || !focusedParticipant.stream
          : true,
      isAudioMuted: viewingHostStream
        ? hostAudioMuted
        : focusedParticipant
          ? focusedParticipant.isAudioMuted
          : isAudioMuted,
      isVideoMuted: viewingHostStream
        ? hostVideoMuted && !hostScreenSharing
        : focusedParticipant
          ? focusedParticipant.isVideoMuted &&
            !focusedParticipant.isScreenSharing
          : false,
    };
  }, [
    effectiveFocusedId,
    hostStream,
    isHost,
    screenStream,
    localStream,
    hostDisplayName,
    hostScreenSharing,
    isScreenAudioShared,
    resolvedDisplayName,
    hostAudioMuted,
    hostStreamPlaybackMuted,
    hostVideoMuted,
    roomConnection?.localParticipantId,
    videoParticipants,
  ]);

  if (sessionStatus === ROOM_SESSION_STATUS.LOADING) {
    return <MeetingLoading message="Loading room…" />;
  }

  if (sessionStatus === ROOM_SESSION_STATUS.ERROR) {
    return (
      <MeetingJoinError
        title="Could not join meeting"
        message={sessionError || "Failed to load room session."}
        onBack={handleBack}
      />
    );
  }

  if (signalingConfigError) {
    return (
      <MeetingJoinError
        title="Signaling not configured"
        message={signalingConfigError}
        hint={getSignalingConfigHint()}
        onBack={handleBack}
      />
    );
  }

  if (fatalConnectionError) {
    return (
      <MeetingJoinError
        title="Could not connect to meeting"
        message={fatalConnectionError}
        hint={getSignalingErrorHint(fatalConnectionError, { isHost })}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className={styles.app}>
      {isRecording && (
        <div
          className={`${styles.recordingBar} ${isRecordingPaused ? styles.recordingBarPaused : ""}`}
          aria-hidden
        />
      )}

      <Header
        meetingDurationSeconds={meetingSeconds}
        roomId={formattedRoomId || null}
        sessionTitle={sessionTitle || null}
        isRecording={isRecording}
        isRecordingPaused={isRecordingPaused}
        recordingDurationSeconds={recordingSeconds}
        onBack={handleBack}
        backLabel={isHost ? "Back to welcome" : "Back to join screen"}
        onShowInviteLink={
          isHost && inviteLink && !inviteBarVisible ? handleShowInviteBar : null
        }
        onSessionTitleChange={isHost ? handleSessionTitleChange : null}
        revealTitleOnLogoClick={!isHost}
      />

      <ConnectionBanner
        isHost={isHost}
        hostPresent={hostPresent}
        connectionError={roomConnection?.connectionError}
        isWaitingForHost={isWaitingForHostMessage(
          roomConnection?.connectionError,
        )}
        isFatalConnectionError={fatalConnectionError}
      />

      {isHost && inviteLink && inviteBarVisible
        ? <InviteBar
            inviteLink={inviteLink}
            inviteCopyMessage={inviteCopyMessage}
            onCopyInviteLink={handleCopyInviteLink}
            onDismiss={handleDismissInviteBar}
          />
        : null}

      <main className={styles.workspace}>
        {isSidebarVisible || isChatVisible
          ? <button
              type="button"
              className={styles.sidebarBackdrop}
              aria-label="Close panels"
              onClick={() => {
                handleCloseSidebar();
                handleCloseChat();
              }}
            />
          : null}

        <div className={styles.stage}>
          <ErrorBanner message={errorMsg} onDismiss={handleDismissError} />

          <RecordingDownloadBanner
            downloadState={downloadState}
            onDismiss={dismissDownloadBanner}
          />

          {savedRecording
            ? <div className={styles.savedRecordingBanner}>
                <span>Recording was interrupted. Save the partial recording?</span>
                <div className={styles.savedRecordingActions}>
                  <button
                    type="button"
                    className={styles.savedRecordingDownload}
                    onClick={downloadSavedRecording}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    className={styles.savedRecordingDiscard}
                    onClick={discardSavedRecording}
                  >
                    Discard
                  </button>
                </div>
              </div>
            : null}

          <div className={styles.gallerySlot}>
            <VideoGallery
              visible={isGalleryVisible}
              screenStream={screenStream}
              localStream={localStream}
              participants={galleryParticipants}
              isAudioMuted={isAudioMuted}
              isVideoMuted={isVideoMuted}
              isScreenSharing={Boolean(screenStream)}
              localDisplayName={resolvedDisplayName}
              localIsSpeaking={localIsSpeaking}
              audioOutputDeviceId={selectedSpeaker}
              focusedParticipantId={effectiveFocusedId}
              allowFocus={isHost}
              onFocusParticipant={handleFocusParticipant}
            />
          </div>

          <div className={styles.videoStage}>
            <PrimaryView
              {...primaryViewProps}
              isRecording={isRecording}
              isRecordingPaused={isRecordingPaused}
              recordingDurationSeconds={recordingSeconds}
              audioOutputDeviceId={selectedSpeaker}
            />
          </div>

          {isPipVisible && localStream && (
            <PipView
              stream={localStream}
              isVideoMuted={isVideoMuted}
              name={resolvedDisplayName}
              initial={resolvedDisplayName?.charAt(0)}
            />
          )}
        </div>

        {isSidebarVisible && isChatVisible && !isMobile
          ? <div
              className={`${styles.combinedSlot} ${isSidebarVisible && isChatVisible && !isMobile ? "" : styles.combinedSlotClosed}`}
            >
              <aside className={styles.combinedSidebar}>
                <div className={styles.combinedSection}>
                  <ParticipantsSidebar
                    visible
                    flex
                    audioList={audioList}
                    videoParticipants={videoParticipants}
                    peerParticipants={peerParticipants}
                    hostDisplayName={hostDisplayName}
                    hostIsAudioMuted={hostAudioMuted}
                    hostIsVideoMuted={hostVideoMuted}
                    hostIsSpeaking={hostIsSpeaking}
                    hostMode={hostMode}
                    isVideoMuted={isVideoMuted}
                    isAudioMuted={isAudioMuted}
                    isHost={isHost}
                    localDisplayName={displayNameInput}
                    localParticipantMode={participantMode}
                    focusedParticipantId={effectiveFocusedId}
                    localIsSpeaking={localIsSpeaking}
                    localIsScreenSharing={Boolean(screenStream)}
                    hostIsScreenSharing={hostScreenSharing}
                    onFocusParticipant={handleFocusParticipant}
                    onClose={handleCloseSidebar}
                    onMuteParticipantVideo={muteParticipantVideo}
                    onMuteParticipantAudio={muteParticipantAudio}
                    onMuteAllVideo={muteAllVideo}
                    onMuteAllAudio={muteAllAudio}
                    canMuteAllVideo={canMuteAllVideo}
                    canMuteAllAudio={canMuteAllAudio}
                  />
                </div>
              </aside>
            </div>
          : <>
              <ParticipantsSidebar
                visible={isSidebarVisible}
                audioList={audioList}
                videoParticipants={videoParticipants}
                peerParticipants={peerParticipants}
                hostDisplayName={hostDisplayName}
                hostIsAudioMuted={hostAudioMuted}
                hostIsVideoMuted={hostVideoMuted}
                hostIsSpeaking={hostIsSpeaking}
                hostMode={hostMode}
                isVideoMuted={isVideoMuted}
                isAudioMuted={isAudioMuted}
                isHost={isHost}
                localDisplayName={displayNameInput}
                localParticipantMode={participantMode}
                focusedParticipantId={effectiveFocusedId}
                localIsSpeaking={localIsSpeaking}
                localIsScreenSharing={Boolean(screenStream)}
                hostIsScreenSharing={hostScreenSharing}
                onFocusParticipant={handleFocusParticipant}
                onClose={handleCloseSidebar}
                onMuteParticipantVideo={muteParticipantVideo}
                onMuteParticipantAudio={muteParticipantAudio}
                onMuteAllVideo={muteAllVideo}
                onMuteAllAudio={muteAllAudio}
                canMuteAllVideo={canMuteAllVideo}
                canMuteAllAudio={canMuteAllAudio}
              />

              <ChatPanel
                visible={isChatVisible}
                messages={chatMessages}
                participants={chatParticipants}
                onClose={handleCloseChat}
                onSendMessage={handleSendChatMessage}
                sessionName={sessionTitle}
              />
            </>}
      </main>

      <ConfirmDialog {...dialogProps} />

      <Toolbar
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        screenStream={screenStream}
        shareScreenAudio={shareScreenAudio}
        isScreenAudioShared={isScreenAudioShared}
        isGalleryVisible={isGalleryVisible}
        isSidebarVisible={isSidebarVisible}
        isPipVisible={isPipVisible}
        isChatVisible={isChatVisible}
        hasUnreadChat={hasUnreadChat}
        isRecording={isRecording}
        isRecordingPaused={isRecordingPaused}
        displayName={displayNameInput}
        onDisplayNameChange={handleDisplayNameChange}
        participantMode={participantMode}
        onParticipantModeChange={handleParticipantModeChange}
        showRecording={isHost}
        allowScreenShare
        availableMicrophones={availableMicrophones}
        selectedMicrophone={selectedMicrophone}
        onMicrophoneChange={switchMicrophone}
        availableSpeakers={availableSpeakers}
        selectedSpeaker={selectedSpeaker}
        onSpeakerChange={switchSpeaker}
        availableCameras={availableCameras}
        selectedCamera={selectedCamera}
        onCameraChange={switchCamera}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onShareScreenAudioChange={setShareScreenAudioPreference}
        onToggleGallery={handleToggleGallery}
        onToggleSidebar={handleToggleSidebar}
        onTogglePip={handleTogglePip}
        onToggleChat={handleToggleChat}
        onStartRecording={startRecording}
        onPauseRecording={pauseRecording}
        onResumeRecording={resumeRecording}
        onStopRecording={stopRecording}
      />
    </div>
  );
}
