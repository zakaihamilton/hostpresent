"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Header } from "@/components/Header";
import { ParticipantsSidebar } from "@/components/ParticipantsSidebar";
import { PrimaryView } from "@/components/PrimaryView";
import { RecordingDownloadBanner } from "@/components/RecordingDownloadBanner";
import { Toolbar } from "@/components/Toolbar";
import { VideoGallery } from "@/components/VideoGallery";
import {
  useConfirmDialog,
  useHostControls,
  useSessionTimers,
  useSignaling,
} from "@/hooks";
import styles from "./MeetingView.module.css";

export function MeetingView({ role, token, onBack }) {
  const isHost = role === "host";

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
  const signaling = useSignaling({ token, enabled: Boolean(token) });
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
    signaling,
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

  const startRecording = useCallback(() => {
    if (!localStream || !isHost) return;

    const activeVideoTrack = screenStream
      ? screenStream.getVideoTracks()[0]
      : localStream.getVideoTracks()[0];
    const hostAudioTrack = localStream.getAudioTracks()[0];
    const screenAudioTracks = screenStream?.getAudioTracks() ?? [];

    const tracksToRecord = [];
    if (activeVideoTrack) tracksToRecord.push(activeVideoTrack);
    for (const track of screenAudioTracks) {
      if (track.readyState === "live") tracksToRecord.push(track);
    }
    if (hostAudioTrack) tracksToRecord.push(hostAudioTrack);

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
  const primaryLabel = screenStream
    ? isScreenAudioShared
      ? "You are sharing your screen with audio"
      : "You are sharing your screen"
    : isHost
      ? "You (Host)"
      : "You";

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
        isRecording={isRecording}
        isRecordingPaused={isRecordingPaused}
        recordingDurationSeconds={recordingSeconds}
        onBack={onBack}
        backLabel="Back to welcome"
      />

      <main className={styles.workspace}>
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
            stream={activeMainStream}
            label={primaryLabel}
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
