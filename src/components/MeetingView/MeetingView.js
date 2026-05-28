"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Header } from "@/components/Header";
import { MeetingJoinError } from "@/components/MeetingJoinError";
import { MeetingLoading } from "@/components/MeetingLoading";
import { ParticipantsSidebar } from "@/components/ParticipantsSidebar";
import { PipView } from "@/components/PipView";
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
import { SIGNALING_MESSAGE } from "@/lib/signaling/messages";
import {
  getSignalingConfigHint,
  getSignalingErrorHint,
  hostPeerId,
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
  const onChatMessageRef = useRef(null);

  const {
    status: sessionStatus,
    roomState,
    error: sessionError,
  } = useRoomSession({ role, token, enabled: Boolean(token) });

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
  const [isPipVisible, setIsPipVisible] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(false);
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
    hostMode: isHost ? participantMode : undefined,
    localStream: null,
    screenStream: null,
    onRemoteParticipant: isHost
      ? (arg) => onRemoteParticipantRef.current?.(arg)
      : undefined,
    onRemoteHostStream: isHost
      ? undefined
      : (arg) => onRemoteHostStreamRef.current?.(arg),
    onChatMessage: (message) => onChatMessageRef.current?.(message),
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
  };

  const handleSendChatMessage = useCallback((text, recipientId) => {
    if (recipientId) {
      roomConnectionRef.current?.sendPrivateChatMessage(text, recipientId);
    } else {
      roomConnectionRef.current?.sendChatMessage(text);
    }
  }, []);

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
    availableCameras,
    selectedCamera,
    switchCamera,
  } = MediaControls({ isHost, roomConnection });

  const {
    videoParticipants,
    setVideoParticipants,
    peerParticipants,
    hostStream,
    hostDisplayName,
    hostAudioMuted,
    hostVideoMuted,
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

      {isHost && inviteLink && inviteBarVisible
        ? <InviteBar
            inviteLink={inviteLink}
            inviteCopyMessage={inviteCopyMessage}
            onCopyInviteLink={handleCopyInviteLink}
            onDismiss={() => setInviteBarVisible(false)}
          />
        : null}

      <main className={styles.workspace}>
        {isSidebarVisible
          ? <button
              type="button"
              className={styles.sidebarBackdrop}
              aria-label="Close participants panel"
              onClick={() => setIsSidebarVisible(false)}
            />
          : null}

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

          {isPipVisible && localStream && (
            <PipView
              stream={localStream}
              isVideoMuted={isVideoMuted}
              name={resolvedDisplayName}
              initial={resolvedDisplayName?.charAt(0)}
            />
          )}
        </div>

        {isSidebarVisible && isChatVisible
          ? <div
              className={`${styles.combinedSlot} ${isSidebarVisible && isChatVisible ? "" : styles.combinedSlotClosed}`}
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
                    hostMode={hostMode}
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
                </div>
                <div className={styles.combinedDivider} />
                <div className={styles.combinedSection}>
                  <ChatPanel
                    visible
                    flex
                    messages={chatMessages}
                    participants={chatParticipants}
                    onClose={() => setIsChatVisible(false)}
                    onSendMessage={handleSendChatMessage}
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
                hostMode={hostMode}
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

              <ChatPanel
                visible={isChatVisible}
                messages={chatMessages}
                participants={chatParticipants}
                onClose={() => setIsChatVisible(false)}
                onSendMessage={handleSendChatMessage}
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
        isRecording={isRecording}
        isRecordingPaused={isRecordingPaused}
        displayName={displayNameInput}
        onDisplayNameChange={handleDisplayNameChange}
        participantMode={participantMode}
        onParticipantModeChange={handleParticipantModeChange}
        showRecording={isHost}
        allowScreenShare={isHost}
        availableCameras={availableCameras}
        selectedCamera={selectedCamera}
        onCameraChange={switchCamera}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onShareScreenAudioChange={setShareScreenAudioPreference}
        onToggleGallery={() => setIsGalleryVisible(!isGalleryVisible)}
        onToggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)}
        onTogglePip={() => setIsPipVisible(!isPipVisible)}
        onToggleChat={() => setIsChatVisible(!isChatVisible)}
        onStartRecording={startRecording}
        onPauseRecording={pauseRecording}
        onResumeRecording={resumeRecording}
        onStopRecording={stopRecording}
      />
    </div>
  );
}
