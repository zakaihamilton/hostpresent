"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Header } from "@/components/Header";
import { MeetingJoinError } from "@/components/MeetingJoinError";
import { MeetingLoading } from "@/components/MeetingLoading";
import { ParticipantsSidebar } from "@/components/ParticipantsSidebar";
import { PrimaryView } from "@/components/PrimaryView";
import { RecordingDownloadBanner } from "@/components/RecordingDownloadBanner";
import { Toolbar } from "@/components/Toolbar";
import { VideoGallery } from "@/components/VideoGallery";
import {
  useConfirmDialog,
  useHostControls,
  useRoomDataChannel,
  useSessionTimers,
} from "@/hooks";
import { useRoomSession, ROOM_SESSION_STATUS } from "@/hooks/roomSession";
import { buildParticipantInviteLink } from "@/lib/room/inviteLink";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatJoinCode } from "@/lib/room/joinCodeFormat";
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
  getSignalingConfigHint,
  getSignalingErrorHint,
  isFatalSignalingError,
  isSignalingConfigError,
  isWaitingForHostMessage,
} from "@/lib/webrtc/peerClient";
import { ConnectionBanner } from "./components/ConnectionBanner/ConnectionBanner";
import { InviteBar } from "./components/InviteBar/InviteBar";
import { MediaControls } from "./hooks/MediaControls";
import { Recording } from "./hooks/Recording";
import { RemoteParticipants } from "./hooks/RemoteParticipants";
import styles from "./MeetingView.module.css";

export function MeetingView({ role, token, joinCode: routeJoinCode, onBack }) {
  const isHost = role === "host";
  const roomConnectionRef = useRef(null);
  const onRemoteParticipantRef = useRef(null);
  const onRemoteHostStreamRef = useRef(null);

  const { status: sessionStatus, roomState, error: sessionError } =
    useRoomSession({ role, token, enabled: Boolean(token) });

  const formattedRoomId = formatJoinCode(
    routeJoinCode ?? roomState?.joinCode ?? "",
  );

  const inviteLink =
    isHost && formattedRoomId
      ? buildParticipantInviteLink(routeJoinCode ?? roomState?.joinCode ?? "")
      : "";

  const [inviteBarVisible, setInviteBarVisible] = useState(false);
  const [inviteCopyMessage, setInviteCopyMessage] = useState("");
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [timersEnabled, setTimersEnabled] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(() =>
    loadDisplayName(),
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [participantMode, setParticipantMode] = useState(() =>
    loadParticipantMode(),
  );

  const resolvedDisplayName = resolveDisplayName(displayNameInput);
  const inviteCopyTimerRef = useRef(null);

  const { meetingSeconds, recordingSeconds, resetRecordingTimer } =
    useSessionTimers({
      isRecording,
      isRecordingPaused,
      enabled: timersEnabled,
    });

  const { confirm, dialogProps } = useConfirmDialog();

  const roomConnection = useRoomDataChannel({
    role,
    token,
    roomId: roomState?.roomId ?? null,
    enabled: Boolean(token && roomState?.roomId),
    displayName: resolvedDisplayName,
    hostAudioMuted: false,
    hostVideoMuted: false,
    localStream: null,
    screenStream: null,
    onRemoteParticipant: isHost
      ? (arg) => onRemoteParticipantRef.current?.(arg)
      : undefined,
    onRemoteHostStream: isHost
      ? undefined
      : (arg) => onRemoteHostStreamRef.current?.(arg),
  });

  roomConnectionRef.current = roomConnection;

  const {
    localStream,
    screenStream,
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
  } = MediaControls({ isHost, roomConnection });

  const {
    videoParticipants,
    setVideoParticipants,
    peerParticipants,
    hostStream,
    hostDisplayName,
    hostAudioMuted,
    hostVideoMuted,
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
    resolvedDisplayName,
    participantMode,
    localStream,
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
  });

  onRemoteParticipantRef.current = handleRemoteParticipant;
  onRemoteHostStreamRef.current = handleRemoteHostStream;

  const {
    downloadState,
    dismissDownloadBanner,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = Recording({
    isHost,
    roomConnection,
    localStream,
    screenStream,
    resetRecordingTimer,
    videoParticipantsLength: videoParticipants.length,
    isRecording,
    setIsRecording,
    isRecordingPaused,
    setIsRecordingPaused,
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
    setTimersEnabled(true);
    return () => {
      for (const cleanup of streamListenerCleanupsRef?.current?.values() ??
        [])
      {
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

  const handleParticipantModeChange = useCallback((mode) => {
    setParticipantMode(mode);
    saveParticipantMode(mode);
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

  const activeMainStream = screenStream || localStream;
  const viewingHostStream = !isHost && hostStream;
  const primaryStream = viewingHostStream ? hostStream : activeMainStream;
  const primaryLabel = viewingHostStream
    ? hostDisplayName
    : screenStream
      ? isScreenAudioShared
        ? "You are sharing your screen with audio"
        : "You are sharing your screen"
      : resolvedDisplayName;
  const primaryMuted = !viewingHostStream;

  if (sessionStatus === ROOM_SESSION_STATUS.LOADING) {
    return <MeetingLoading message="Loading room\u2026" />;
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
        isRecording={isRecording}
        isRecordingPaused={isRecordingPaused}
        recordingDurationSeconds={recordingSeconds}
        onBack={handleBack}
        backLabel={isHost ? "Back to welcome" : "Back to join screen"}
        onShowInviteLink={
          isHost && inviteLink && !inviteBarVisible
            ? () => setInviteBarVisible(true)
            : null
        }
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

      {isHost && inviteLink && inviteBarVisible ? (
        <InviteBar
          inviteLink={inviteLink}
          inviteCopyMessage={inviteCopyMessage}
          onCopyInviteLink={handleCopyInviteLink}
          onDismiss={() => setInviteBarVisible(false)}
        />
      ) : null}

      <main className={styles.workspace}>
        {isSidebarVisible ? (
          <button
            type="button"
            className={styles.sidebarBackdrop}
            aria-label="Close participants panel"
            onClick={() => setIsSidebarVisible(false)}
          />
        ) : null}

        <div className={styles.stage}>
          <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg("")} />

          <RecordingDownloadBanner
            downloadState={downloadState}
            onDismiss={dismissDownloadBanner}
          />

          <div className={styles.gallerySlot}>
            <VideoGallery
              visible={isGalleryVisible}
              screenStream={screenStream}
              localStream={localStream}
              participants={videoParticipants}
              isAudioMuted={isAudioMuted}
              localDisplayName={resolvedDisplayName}
            />
          </div>

          <div className={styles.videoStage}>
            <PrimaryView
              stream={primaryStream}
              label={primaryLabel}
              isMuted={primaryMuted}
              isAudioMuted={viewingHostStream ? hostAudioMuted : false}
              isVideoMuted={viewingHostStream ? hostVideoMuted : false}
              isRecording={isRecording}
              isRecordingPaused={isRecordingPaused}
              recordingDurationSeconds={recordingSeconds}
            />
          </div>
        </div>

        <ParticipantsSidebar
          visible={isSidebarVisible}
          audioList={audioList}
          videoParticipants={videoParticipants}
          peerParticipants={peerParticipants}
          hostDisplayName={hostDisplayName}
          hostIsAudioMuted={hostAudioMuted}
          hostIsVideoMuted={hostVideoMuted}
          isVideoMuted={isVideoMuted}
          isAudioMuted={isAudioMuted}
          isHost={isHost}
          localDisplayName={displayNameInput}
          localParticipantMode={participantMode}
          onClose={() => setIsSidebarVisible(false)}
          onMuteParticipantVideo={muteParticipantVideo}
          onMuteParticipantAudio={muteParticipantAudio}
          onMuteAllVideo={muteAllVideo}
          onMuteAllAudio={muteAllAudio}
          canMuteAllVideo={canMuteAllVideo}
          canMuteAllAudio={canMuteAllAudio}
        />
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
        isRecording={isRecording}
        isRecordingPaused={isRecordingPaused}
        displayName={displayNameInput}
        onDisplayNameChange={handleDisplayNameChange}
        participantMode={!isHost ? participantMode : null}
        onParticipantModeChange={
          !isHost ? handleParticipantModeChange : null
        }
        showRecording={isHost}
        allowScreenShare={isHost}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onShareScreenAudioChange={setShareScreenAudioPreference}
        onToggleGallery={() => setIsGalleryVisible(!isGalleryVisible)}
        onToggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)}
        onStartRecording={startRecording}
        onPauseRecording={pauseRecording}
        onResumeRecording={resumeRecording}
        onStopRecording={stopRecording}
      />
    </div>
  );
}
