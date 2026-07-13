"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectionBanner } from "@/components/meeting/ConnectionBanner/ConnectionBanner";
import { DiagnosticsPopup } from "@/components/meeting/DiagnosticsPopup";
import { Header } from "@/components/meeting/Header";
import { InviteBar } from "@/components/meeting/InviteBar/InviteBar";
import { Recording } from "@/components/meeting/Recording";
import { Toolbar } from "@/components/meeting/Toolbar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MeetingJoinError } from "@/components/ui/MeetingJoinError";
import { MeetingLoading } from "@/components/ui/MeetingLoading";
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
  loadChatVisible,
  loadGalleryVisible,
  loadSidebarVisible,
  saveChatVisible,
  saveGalleryVisible,
  saveSidebarVisible,
} from "@/lib/settings/layoutSettings";
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
  getSignalingConfigHint,
  getSignalingErrorHint,
  hostPeerId,
  isFatalSignalingError,
  isSignalingConfigError,
  isWaitingForHostMessage,
} from "@/lib/webrtc/peerClient";
import { getAutoFocusTargetId } from "./autoFocus";
import { MeetingWorkspace } from "./components/MeetingWorkspace";
import { MediaControls } from "./hooks/MediaControls";
import {
  attachSpeakingDetector,
  RemoteParticipants,
} from "./hooks/RemoteParticipants";
import styles from "./MeetingView.module.css";

export function MeetingView({ token, ...props }) {
  return (
    <PeerStreamConnection sessionToken={token}>
      <MeetingViewInner token={token} {...props} />
    </PeerStreamConnection>
  );
}

function _isTouchOrMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isSmallScreen = window.innerWidth <= 1024 || window.innerHeight <= 700;
  return hasTouch || isMobileUA || isSmallScreen;
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
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isPipVisible, setIsPipVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      if (typeof window === "undefined") return false;
      return window.innerWidth <= 1024 || window.innerHeight <= 550;
    };

    const handleResize = () => {
      const mobile = checkIsMobile();
      setIsMobile(mobile);
      if (mobile) {
        // Always clear panels on mobile resize — never persist open state
        saveChatVisible(false);
        saveSidebarVisible(false);
        setIsSidebarVisible(false);
        setIsChatVisible(false);
      }
    };

    // Hydration-safe: read from localStorage strictly on client mount
    setIsGalleryVisible(loadGalleryVisible());
    const isMobileDevice = checkIsMobile();
    setIsMobile(isMobileDevice);
    if (isMobileDevice) {
      // Mobile: always start with panels closed and wipe any stale persisted state
      saveChatVisible(false);
      saveSidebarVisible(false);
      setIsSidebarVisible(false);
      setIsChatVisible(false);
    } else {
      setIsSidebarVisible(loadSidebarVisible());
      setIsChatVisible(loadChatVisible());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  useEffect(() => {
    saveGalleryVisible(isGalleryVisible);
  }, [isGalleryVisible]);
  useEffect(() => {
    if (!isMobile) saveSidebarVisible(isSidebarVisible);
  }, [isMobile, isSidebarVisible]);
  useEffect(() => {
    if (!isMobile) saveChatVisible(isChatVisible);
  }, [isMobile, isChatVisible]);
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

  useEffect(() => {
    if (focusedParticipantId !== "") {
      setEffectiveFocusedId(focusedParticipantId);
      return undefined;
    }

    if (autoFocusTargetId !== "host") {
      setEffectiveFocusedId(autoFocusTargetId);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setEffectiveFocusedId(autoFocusTargetId);
    }, AUTO_FOCUS_INACTIVITY_MS);

    return () => window.clearTimeout(timer);
  }, [focusedParticipantId, autoFocusTargetId]);

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

  const handleToggleGallery = useCallback(() => {
    setIsGalleryVisible((v) => !v);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarVisible((v) => {
      const next = !v;
      if (next && isMobile) {
        setIsChatVisible(false);
      }
      return next;
    });
  }, [isMobile]);

  const handleTogglePip = useCallback(() => {
    setIsPipVisible((v) => !v);
  }, []);

  const handleToggleChat = useCallback(() => {
    setIsChatVisible((v) => {
      const next = !v;
      if (next && isMobile) {
        setIsSidebarVisible(false);
      }
      return next;
    });
  }, [isMobile]);

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

    return tiles;
  }, [
    hostAudioMuted,
    hostDisplayName,
    hostIsSpeaking,
    hostStream,
    hostVideoMuted,
    hostScreenSharing,
    isHost,
    peerParticipants,
    roomConnection?.localParticipantId,
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
    const isLocalCamera =
      !viewingHostStream &&
      !screenStream &&
      (focusedIsSelf || !focusedParticipant);
    return {
      stream: viewingHostStream ? hostStream : activeMain,
      isMirrored: isLocalCamera,
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
    isAudioMuted,
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

  if (meetingDisconnectReason === "limit_reached") {
    return (
      <MeetingJoinError
        title="Meeting limit reached"
        message="This meeting has reached the 6-hour limit."
        onBack={handleDisconnectBack}
      />
    );
  }

  if (meetingDisconnectReason === "ended") {
    return (
      <MeetingJoinError
        title="Meeting ended"
        message="The host has ended this meeting."
        onBack={handleDisconnectBack}
      />
    );
  }

  if (meetingDisconnectReason === "full") {
    return (
      <MeetingJoinError
        title="Meeting is full"
        message="This meeting has reached the maximum capacity of 30 participants."
        onBack={handleDisconnectBack}
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
        onShowInviteLink={
          isHost && inviteLink && !inviteBarVisible ? handleShowInviteBar : null
        }
        onSessionTitleChange={isHost ? handleSessionTitleChange : null}
        revealTitleOnLogoClick={!isHost}
        showRecording={isHost}
        onStartRecording={startRecording}
        onPauseRecording={pauseRecording}
        onResumeRecording={resumeRecording}
        onStopRecording={stopRecording}
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
            roomId={formattedRoomId}
          />
        : null}

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
        onCloseChat={handleCloseChat}
        onClosePanels={() => {
          handleCloseSidebar();
          handleCloseChat();
        }}
        onCloseSidebar={handleCloseSidebar}
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

      <ConfirmDialog {...dialogProps} />

      <DiagnosticsPopup
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        role={role}
        roomId={formattedRoomId || roomState?.joinCode}
        connectionStatus={roomConnection?.status}
        localParticipantId={roomConnection?.localParticipantId}
        peerConfig={roomConnection?.peerConfig}
        iceServers={roomConnection?.iceServers}
        activeConnectionsCount={roomConnection?.activeConnectionsCount}
        connectionError={roomConnection?.connectionError}
        onReconnect={roomConnection?.reconnect}
        isTurnActive={roomConnection?.isTurnActive}
      />

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
        displayName={displayNameInput}
        onDisplayNameChange={handleDisplayNameChange}
        participantMode={participantMode}
        onParticipantModeChange={
          handleDisplayNameChange ? handleParticipantModeChange : null
        }
        allowScreenShare={true}
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
        isHost={isHost}
        onEndMeeting={handleEndMeeting}
        onLeave={handleBack}
        participantCount={
          isHost
            ? 1 + videoParticipants.length + audioList.length
            : 2 + peerParticipants.length
        }
      />
    </div>
  );
}
