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
import { formatJoinCode } from "@/lib/room/joinCodeFormat";
import { SIGNALING_MESSAGE } from "@/lib/signaling/messages";
import {
  getSignalingConfigHint,
  isFatalSignalingError,
  isWaitingForHostMessage,
} from "@/lib/webrtc/peerClient";
import {
  pickOutboundVideoTrack,
  resolveOutboundAudioTrack,
} from "@/lib/webrtc/outboundMedia";
import styles from "./MeetingView.module.css";

function participantColor(id) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360} 55% 45%)`;
}

export function MeetingView({ role, token, joinCode: routeJoinCode, onBack }) {
  const isHost = role === "host";

  const { status: sessionStatus, roomState, error: sessionError } = useRoomSession({
    role,
    token,
    enabled: Boolean(token),
  });

  const formattedRoomId = formatJoinCode(
    routeJoinCode ?? roomState?.joinCode ?? "",
  );

  const inviteLink =
    isHost && formattedRoomId
      ? buildParticipantInviteLink(routeJoinCode ?? roomState?.joinCode ?? "")
      : "";

  const [hostStream, setHostStream] = useState(null);
  const [inviteCopyMessage, setInviteCopyMessage] = useState("");

  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const [videoParticipants, setVideoParticipants] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [shareScreenAudio, setShareScreenAudio] = useState(true);
  const [downloadState, setDownloadState] = useState(null);
  const [timeString, setTimeString] = useState("--:--");
  const [audioList, setAudioList] = useState([]);
  const [timersEnabled, setTimersEnabled] = useState(false);

  const { meetingSeconds, recordingSeconds, resetRecordingTimer } =
    useSessionTimers({
      isRecording,
      isRecordingPaused,
      enabled: timersEnabled,
    });

  const { confirm, dialogProps } = useConfirmDialog();

  const [hostPresent, setHostPresent] = useState(isHost);

  const handleRemoteHostStream = useCallback((stream) => {
    setHostStream(stream);
  }, []);

  const handleRemoteParticipant = useCallback((participant) => {
    if (!participant?.id) return;
    setVideoParticipants((previous) => {
      const existing = previous.find((entry) => entry.id === participant.id);
      if (existing) {
        return previous.map((entry) =>
          entry.id === participant.id ? { ...entry, ...participant } : entry,
        );
      }
      return [
        ...previous,
        {
          id: participant.id,
          name: participant.name ?? "Guest",
          avatarColor: participantColor(participant.id),
          isAudioMuted: false,
          isVideoMuted: false,
          stream: participant.stream ?? null,
        },
      ];
    });
  }, []);

  const roomConnection = useRoomDataChannel({
    role,
    token,
    roomId: roomState?.roomId ?? null,
    enabled: Boolean(token && roomState?.roomId),
    localStream,
    screenStream,
    onRemoteParticipant: isHost ? handleRemoteParticipant : undefined,
    onRemoteHostStream: isHost ? undefined : handleRemoteHostStream,
  });

  const fatalConnectionError =
    roomConnection.connectionError &&
    isFatalSignalingError(roomConnection.connectionError)
      ? roomConnection.connectionError
      : null;
  const signalingConfigError =
    fatalConnectionError?.includes("Signaling server is not configured") ||
    fatalConnectionError?.includes("Could not load signaling configuration")
      ? fatalConnectionError
      : null;

  useEffect(() => {
    if (isHost) {
      setHostPresent(true);
      return;
    }
    setHostPresent(roomConnection.hostPresent);
  }, [isHost, roomConnection.hostPresent]);

  useEffect(() => {
    if (isHost) return undefined;

    return roomConnection.subscribe((message) => {
      const localId = roomConnection.localParticipantId;

      switch (message.type) {
        case SIGNALING_MESSAGE.HOST_MUTE_AUDIO:
          if (message.participantId && message.participantId !== localId) return;
          localStream?.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsAudioMuted(true);
          break;
        case SIGNALING_MESSAGE.HOST_MUTE_VIDEO:
          if (message.participantId && message.participantId !== localId) return;
          localStream?.getVideoTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsVideoMuted(true);
          break;
        case SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO:
          localStream?.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsAudioMuted(true);
          break;
        case SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO:
          localStream?.getVideoTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsVideoMuted(true);
          break;
        default:
          break;
      }
    });
  }, [isHost, localStream, roomConnection]);

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

  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const downloadDismissTimerRef = useRef(null);

  const isScreenAudioShared = Boolean(
    screenStream?.getAudioTracks().some((track) => track.readyState === "live"),
  );

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  useEffect(() => {
    const formatTime = () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

    setTimeString(formatTime());
    setTimersEnabled(true);

    const timer = setInterval(() => setTimeString(formatTime()), 1000);

    const initLocalMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
      } catch (err) {
        console.error("Failed to acquire camera/mic permissions:", err);
      }
    };
    initLocalMedia();

    return () => {
      clearInterval(timer);
      if (downloadDismissTimerRef.current) {
        clearTimeout(downloadDismissTimerRef.current);
      }
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
      }
      if (screenStreamRef.current) {
        for (const track of screenStreamRef.current.getTracks()) {
          track.stop();
        }
      }
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      recordingChunksRef.current = [];
    };
  }, []);

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(!localStream.getAudioTracks()[0].enabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoMuted(!localStream.getVideoTracks()[0].enabled);
    }
  };

  const toggleScreenShare = async () => {
    if (screenStream) {
      for (const track of screenStream.getTracks()) {
        track.stop();
      }
      setScreenStream(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: shareScreenAudio
            ? {
                suppressLocalAudioPlayback: false,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              }
            : false,
        });

        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
        };

        setScreenStream(stream);
        setErrorMsg("");

        if (shareScreenAudio && stream.getAudioTracks().length === 0) {
          setErrorMsg(
            "Screen shared without audio. Enable “Share tab audio” in the browser picker, or turn on Share Audio before sharing.",
          );
        }
      } catch (err) {
        console.warn("Screen sharing failed:", err);
        if (err?.name === "NotAllowedError") {
          setErrorMsg(
            "Screen sharing was cancelled or denied. Allow screen capture and try again.",
          );
        } else {
          setErrorMsg(
            "Could not start screen sharing. Check browser permissions and try again.",
          );
        }
      }
    }
  };

  const setShareScreenAudioPreference = (includeAudio) => {
    setShareScreenAudio(includeAudio);
  };

  const dismissDownloadBanner = useCallback(() => {
    if (downloadDismissTimerRef.current) {
      clearTimeout(downloadDismissTimerRef.current);
      downloadDismissTimerRef.current = null;
    }
    setDownloadState(null);
  }, []);

  const updateDownloadProgress = useCallback((phase, progress, filename) => {
    setDownloadState({ phase, progress, filename });
  }, []);

  const finalizeRecordingDownload = useCallback(async () => {
    const filename = `Host-Present-Meeting-${new Date().toISOString().slice(0, 10)}.mp4`;
    const chunks = recordingChunksRef.current;
    const chunkCount = chunks.length;

    updateDownloadProgress("building", 15, filename);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    let processed = 0;
    for (let index = 0; index < chunkCount; index += 1) {
      processed += 1;
      const progress =
        15 + Math.round((processed / Math.max(chunkCount, 1)) * 55);
      updateDownloadProgress("building", progress, filename);
      if (index % 4 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const blob = new Blob(chunks, { type: "video/mp4" });
    updateDownloadProgress("saving", 85, filename);
    await new Promise((resolve) => setTimeout(resolve, 120));

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.style.display = "none";
    anchor.href = url;
    anchor.download = filename;

    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    }, 100);

    recordingChunksRef.current = [];
    updateDownloadProgress("complete", 100, filename);

    downloadDismissTimerRef.current = setTimeout(() => {
      setDownloadState(null);
      downloadDismissTimerRef.current = null;
    }, 5000);
  }, [updateDownloadProgress]);

  const startRecording = useCallback(async () => {
    if (!localStream || !isHost) return;

    const activeVideoTrack = pickOutboundVideoTrack(localStream, screenStream);
    const audioTrack = await resolveOutboundAudioTrack(localStream, screenStream);

    const tracksToRecord = [activeVideoTrack, audioTrack].filter(Boolean);
    const compositeStream = new MediaStream(tracksToRecord);

    let options = { mimeType: "video/mp4;codecs=avc1" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/mp4" };
    }

    let recorder;
    try {
      recorder = new MediaRecorder(compositeStream, options);
    } catch (e) {
      console.warn(
        "MP4 format not fully supported by browser, falling back to default.",
        e,
      );
      recorder = new MediaRecorder(compositeStream);
    }

    mediaRecorderRef.current = recorder;
    recordingChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      void finalizeRecordingDownload();
    };

    recorder.start(1000);
    resetRecordingTimer();
    setIsRecording(true);
    setIsRecordingPaused(false);
  }, [
    finalizeRecordingDownload,
    isHost,
    localStream,
    resetRecordingTimer,
    screenStream,
  ]);

  const pauseRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      setIsRecordingPaused(true);
    }
  };

  const resumeRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      setIsRecordingPaused(false);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      updateDownloadProgress("preparing", 5);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsRecordingPaused(false);
      resetRecordingTimer();
    }
  };

  const activeMainStream = screenStream || localStream;
  const viewingHostStream = !isHost && hostStream;
  const primaryStream = viewingHostStream ? hostStream : activeMainStream;
  const primaryLabel = viewingHostStream
    ? "Host"
    : screenStream
      ? isScreenAudioShared
        ? "You are sharing your screen with audio"
        : "You are sharing your screen"
      : isHost
        ? "You (Host)"
        : "You";
  const primaryMuted = !viewingHostStream;

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopyMessage("Invite link copied");
      setTimeout(() => setInviteCopyMessage(""), 2500);
    } catch {
      setInviteCopyMessage("Could not copy invite link");
    }
  };

  if (sessionStatus === ROOM_SESSION_STATUS.LOADING) {
    return <MeetingLoading message="Loading room…" />;
  }

  if (sessionStatus === ROOM_SESSION_STATUS.ERROR) {
    return (
      <MeetingJoinError
        title="Could not join meeting"
        message={sessionError || "Failed to load room session."}
        onBack={onBack}
      />
    );
  }

  if (signalingConfigError) {
    return (
      <MeetingJoinError
        title="Signaling not configured"
        message={signalingConfigError}
        hint={getSignalingConfigHint()}
        onBack={onBack}
      />
    );
  }

  if (fatalConnectionError) {
    return (
      <MeetingJoinError
        title="Could not connect to meeting"
        message={fatalConnectionError}
        hint={
          isHost
            ? "Set SIGNALING_SERVER_URL on the server (Vercel env vars or .env.local). Redeploy after changing env vars."
            : "Ask the host to join the meeting first. If the problem continues, the signaling server may be down or misconfigured."
        }
        onBack={onBack}
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
        timeString={timeString}
        meetingDurationSeconds={meetingSeconds}
        roomId={formattedRoomId || null}
        isRecording={isRecording}
        isRecordingPaused={isRecordingPaused}
        recordingDurationSeconds={recordingSeconds}
        onBack={onBack}
        backLabel={isHost ? "Back to welcome" : "Back to join screen"}
      />

      {!isHost && !hostPresent && roomConnection.connectionError
        ? <div className={styles.hostWaitingBanner} role="status">
            <p className={styles.hostWaitingText}>
              {roomConnection.connectionError}
            </p>
          </div>
        : null}

      {!isHost && !hostPresent && !roomConnection.connectionError
        ? <div className={styles.hostWaitingBanner} role="status">
            <p className={styles.hostWaitingText}>Waiting for the host to join…</p>
          </div>
        : null}

      {roomConnection.connectionError &&
      !isHost &&
      !isWaitingForHostMessage(roomConnection.connectionError) &&
      !fatalConnectionError
        ? <div className={styles.signalingErrorBanner} role="alert">
            <p className={styles.signalingErrorText}>
              {roomConnection.connectionError}
            </p>
          </div>
        : null}

      {isHost &&
      roomConnection.connectionError &&
      !fatalConnectionError
        ? <div className={styles.signalingErrorBanner} role="alert">
            <p className={styles.signalingErrorText}>
              {roomConnection.connectionError}
            </p>
          </div>
        : null}

      {isHost && inviteLink
        ? <div className={styles.shareBar}>
            <p className={styles.shareLabel}>
              Share this invite link for participants on other devices:
            </p>
            <div className={styles.shareRow}>
              <input
                className={styles.shareInput}
                readOnly
                value={inviteLink}
                aria-label="Participant invite link"
              />
              <button
                type="button"
                className={styles.shareButton}
                onClick={handleCopyInviteLink}
              >
                Copy link
              </button>
            </div>
            {inviteCopyMessage
              ? <p className={styles.shareFeedback}>{inviteCopyMessage}</p>
              : null}
          </div>
        : null}

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

          <VideoGallery
            visible={isGalleryVisible}
            screenStream={screenStream}
            localStream={localStream}
            participants={videoParticipants}
            isAudioMuted={isAudioMuted}
          />

          <PrimaryView
            stream={primaryStream}
            label={primaryLabel}
            isMuted={primaryMuted}
            isRecording={isRecording}
            isRecordingPaused={isRecordingPaused}
            recordingDurationSeconds={recordingSeconds}
          />
        </div>

        <ParticipantsSidebar
          visible={isSidebarVisible}
          audioList={audioList}
          videoParticipants={videoParticipants}
          isVideoMuted={isVideoMuted}
          isAudioMuted={isAudioMuted}
          isHost={isHost}
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
