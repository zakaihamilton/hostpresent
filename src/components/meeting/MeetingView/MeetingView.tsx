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
import type { RemoteParticipantUpdate } from "@/hooks/roomDataChannel/types";
import type { RoomSessionStatus } from "@/hooks/roomSession";
import { useRoomSession } from "@/hooks/roomSession";
import { buildParticipantInviteLink } from "@/lib/room/inviteLink";
import { formatJoinCode, isValidJoinCode } from "@/lib/room/joinCodeFormat";
import type { RoomRole, RoomState } from "@/lib/room/roomTypes";
import {
  loadDisplayName,
  loadParticipantMode,
  PARTICIPANT_MODE,
  resolveDisplayName,
} from "@/lib/settings/displayNameSettings";
import type { ChatMessage } from "@/lib/signaling/messages";
import {
  isFatalSignalingError,
  isSignalingConfigError,
} from "@/lib/webrtc/peerClient";
import { attachSpeakingDetector } from "@/lib/webrtc/speakingDetector";
import { MediaControls } from "./hooks/MediaControls";
import {
  type RemoteParticipantsConnection,
  useRemoteParticipants,
} from "./hooks/RemoteParticipants";
import { useMeetingChat } from "./hooks/useMeetingChat";
import { useMeetingFocus } from "./hooks/useMeetingFocus";
import { useMeetingInvite } from "./hooks/useMeetingInvite";
import { useMeetingLayoutState } from "./hooks/useMeetingLayoutState";
import { useMeetingScreenProps } from "./hooks/useMeetingScreenProps";
import { useMeetingSessionLifecycle } from "./hooks/useMeetingSessionLifecycle";
import { useMeetingViewModels } from "./hooks/useMeetingViewModels";
import { MeetingViewScreen } from "./MeetingViewScreen";
import { getMeetingStatusScreen } from "./meetingStatusScreen";

interface MeetingViewProps {
  token?: string;
  role?: RoomRole;
  joinCode?: string | null;
  onBack: () => void;
}

export function MeetingView({
  token,
  role,
  joinCode,
  onBack,
}: MeetingViewProps) {
  const {
    status: sessionStatus,
    roomState,
    error: sessionError,
  } = useRoomSession({
    role,
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
        role={role}
        joinCode={joinCode}
        onBack={onBack}
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
}: {
  role?: RoomRole;
  token?: string;
  joinCode?: string | null;
  onBack: () => void;
  sessionStatus: RoomSessionStatus;
  roomState: RoomState | null;
  sessionError: string;
}) {
  const isHost = role === "host";
  const roomConnectionRef = useRef<RemoteParticipantsConnection | null>(null);
  const onRemoteParticipantRef = useRef<
    ((participant: RemoteParticipantUpdate) => void) | null
  >(null);
  const onRemoteHostStreamRef = useRef<
    ((stream: MediaStream | null) => void) | null
  >(null);
  const onChatMessageRef = useRef<((message: ChatMessage) => void) | null>(
    null,
  );

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

  const {
    inviteBarVisible,
    inviteCopyMessage,
    handleShowInviteBar,
    handleDismissInviteBar,
    handleCopyInviteLink,
  } = useMeetingInvite(inviteLink);
  const layout = useMeetingLayoutState();
  const [timersEnabled, setTimersEnabled] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(() =>
    loadDisplayName(),
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [participantMode, setParticipantMode] = useState(() =>
    isHost ? loadParticipantMode() : PARTICIPANT_MODE.LISTENING,
  );
  const [sessionTitle, setSessionTitle] = useState("");
  const [focusedParticipantId, setFocusedParticipantId] = useState("");
  const [meetingDisconnectReason, setMeetingDisconnectReason] = useState<
    "ended" | "full" | "limit_reached" | null
  >(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const resolvedDisplayName = useMemo(
    () => resolveDisplayName(displayNameInput),
    [displayNameInput],
  );

  const { meetingSeconds, recordingSeconds, resetRecordingTimer } =
    useSessionTimers({
      isRecording,
      isRecordingPaused,
      enabled: timersEnabled,
    });

  const { confirm, dialogProps } = useConfirmDialog();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [localIsSpeaking, setLocalIsSpeaking] = useState(false);
  const localSpeakingCleanupRef = useRef<(() => void) | null>(null);

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
    (participant: RemoteParticipantUpdate) =>
      onRemoteParticipantRef.current?.(participant),
    [],
  );
  const onRemoteHostStream = useCallback(
    (stream: MediaStream | null) => onRemoteHostStreamRef.current?.(stream),
    [],
  );
  const onChatMessage = useCallback(
    (message: ChatMessage) => onChatMessageRef.current?.(message),
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
  const canPublishMedia = isHost || roomConnection.canPublish === true;

  const { chatMessages, receiveChatMessage, handleSendChatMessage } =
    useMeetingChat({
      isHost,
      roomId: roomState?.roomId,
      roomConnectionRef,
      isChatVisible: layout.isChatVisible,
      setHasUnreadChat: layout.setHasUnreadChat,
    });
  onChatMessageRef.current = receiveChatMessage;

  const {
    isAudioMuted,
    isVideoMuted,
    localTrackRevision,
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
    publishingGranted: canPublishMedia,
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
  } = useRemoteParticipants({
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

  const effectiveFocusedId = useMeetingFocus({
    focusedParticipantId,
    videoParticipants: videoParticipants.filter((participant) =>
      roomConnection.publisherIds?.includes(participant.id),
    ),
    isHost,
    localIsSpeaking,
    screenStream,
    isVideoMuted,
    hostIsSpeaking,
    hostScreenSharing,
    hostVideoMuted,
  });

  const {
    downloadState,
    isRecordingBusy,
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
    localTrackRevision,
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

  const {
    sendDiagnosticReport,
    handleBack,
    handleDisconnectBack,
    handleDisplayNameChange,
    handleSessionTitleChange,
    handleParticipantModeChange,
    handleFocusParticipant,
    handleEndMeeting,
    handleDismissError,
  } = useMeetingSessionLifecycle({
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
  });

  const fatalConnectionError =
    roomConnection?.connectionError &&
    isFatalSignalingError(roomConnection.connectionError)
      ? roomConnection.connectionError
      : null;
  const signalingConfigError =
    fatalConnectionError && isSignalingConfigError(fatalConnectionError)
      ? fatalConnectionError
      : null;

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

  const screenProps = useMeetingScreenProps({
    role,
    isHost,
    formattedRoomId,
    sessionTitle,
    meetingSeconds,
    recordingSeconds,
    isRecording,
    isRecordingPaused,
    isRecordingBusy,
    inviteLink,
    inviteBarVisible,
    inviteCopyMessage,
    handleShowInviteBar,
    handleCopyInviteLink,
    handleDismissInviteBar,
    handleSessionTitleChange,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    hostPresent,
    roomConnection,
    fatalConnectionError,
    chatMessages,
    chatParticipants,
    handleSendChatMessage,
    downloadState,
    errorMsg,
    layout,
    screenStream,
    localStream,
    isAudioMuted,
    isVideoMuted,
    resolvedDisplayName,
    localIsSpeaking,
    selectedSpeaker,
    effectiveFocusedId,
    focusedParticipantId,
    handleFocusParticipant,
    dismissDownloadBanner,
    handleDismissError,
    setIsDiagnosticsOpen,
    audioList,
    videoParticipants,
    peerParticipants,
    hostDisplayName,
    hostAudioMuted,
    hostVideoMuted,
    hostIsSpeaking,
    hostMode,
    displayNameInput,
    participantMode,
    hostScreenSharing,
    muteParticipantVideo,
    muteParticipantAudio,
    muteAllVideo,
    muteAllAudio,
    canMuteAllVideo,
    canMuteAllAudio,
    primaryViewProps,
    toggleScreenShare,
    canResumeSavedRecording,
    resumeSavedRecording,
    downloadSavedRecording,
    discardSavedRecording,
    savedRecording,
    galleryParticipants,
    dialogProps,
    isDiagnosticsOpen,
    sendDiagnosticReport,
    shareScreenAudio,
    isScreenAudioShared,
    handleDisplayNameChange,
    handleParticipantModeChange,
    availableMicrophones,
    selectedMicrophone,
    switchMicrophone,
    isVoiceIsolationEnabled,
    isVoiceIsolationChanging,
    setVoiceIsolation,
    availableSpeakers,
    switchSpeaker,
    availableCameras,
    selectedCamera,
    switchCamera,
    toggleAudio,
    toggleVideo,
    setShareScreenAudioPreference,
    handleEndMeeting,
    handleBack,
    canPublishMedia,
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

  return <MeetingViewScreen {...screenProps} />;
}
