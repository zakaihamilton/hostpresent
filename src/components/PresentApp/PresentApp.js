"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Header } from "@/components/Header";
import { ParticipantsSidebar } from "@/components/ParticipantsSidebar";
import { PrimaryView } from "@/components/PrimaryView";
import { Toolbar } from "@/components/Toolbar";
import { VideoGallery } from "@/components/VideoGallery";
import { useSessionTimers } from "@/hooks/useSessionTimers";
import { createMockScreenShareStream, createMockStream } from "@/lib/mockMedia";
import { generateMockParticipants } from "@/lib/mockParticipants";
import styles from "./PresentApp.module.css";

export function PresentApp() {
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [mockVideoParticipants, setMockVideoParticipants] = useState([]);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isGalleryVisible, setIsGalleryVisible] = useState(true);

  const [timeString, setTimeString] = useState("--:--");
  const [audioList, setAudioList] = useState([]);
  const [timersEnabled, setTimersEnabled] = useState(false);

  const { meetingSeconds, recordingSeconds, resetRecordingTimer } =
    useSessionTimers({
      isRecording,
      isRecordingPaused,
      enabled: timersEnabled,
    });

  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const localStreamRef = useRef(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    const formatTime = () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

    setTimeString(formatTime());
    setAudioList(generateMockParticipants());
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

    const mockVideos = [
      {
        id: "v1",
        name: "Elena R.",
        stream: createMockStream("Elena R.", "#0f766e"),
      },
      {
        id: "v2",
        name: "Marcus T.",
        stream: createMockStream("Marcus T.", "#4338ca"),
      },
      {
        id: "v3",
        name: "Sarah L.",
        stream: createMockStream("Sarah L.", "#b91c1c"),
      },
      {
        id: "v4",
        name: "David K.",
        stream: createMockStream("David K.", "#b45309"),
      },
    ];
    setMockVideoParticipants(mockVideos);

    return () => {
      clearInterval(timer);
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
      }
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
          audio: true,
        });

        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
        };

        setScreenStream(stream);
        setErrorMsg("");
      } catch (err) {
        console.warn(
          "Screen sharing restricted. Falling back to mock stream.",
          err,
        );
        const mockStream = createMockScreenShareStream();
        setScreenStream(mockStream);
        setErrorMsg(
          "Screen sharing is restricted in this embedded view. Using a mock screen share for demonstration. Export the code to use real screen sharing.",
        );
      }
    }
  };

  const startRecording = useCallback(() => {
    if (!localStream) return;

    const activeVideoTrack = screenStream
      ? screenStream.getVideoTracks()[0]
      : localStream.getVideoTracks()[0];
    const hostAudioTrack = localStream.getAudioTracks()[0];

    const tracksToRecord = [];
    if (activeVideoTrack) tracksToRecord.push(activeVideoTrack);
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
      const blob = new Blob(recordingChunksRef.current, { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `Host-Present-Meeting-${new Date().toISOString().slice(0, 10)}.mp4`;

      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);

      recordingChunksRef.current = [];
    };

    recorder.start(1000);
    resetRecordingTimer();
    setIsRecording(true);
    setIsRecordingPaused(false);
  }, [localStream, screenStream, resetRecordingTimer]);

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
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsRecordingPaused(false);
      resetRecordingTimer();
    }
  };

  const activeMainStream = screenStream || localStream;

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
      />

      <main className={styles.workspace}>
        <div className={styles.stage}>
          <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg("")} />

          <VideoGallery
            visible={isGalleryVisible}
            screenStream={screenStream}
            localStream={localStream}
            participants={mockVideoParticipants}
            isAudioMuted={isAudioMuted}
          />

          <PrimaryView
            stream={activeMainStream}
            label={screenStream ? "You are sharing your screen" : "You (Host)"}
            isRecording={isRecording}
            isRecordingPaused={isRecordingPaused}
            recordingDurationSeconds={recordingSeconds}
          />
        </div>

        <ParticipantsSidebar
          visible={isSidebarVisible}
          audioList={audioList}
          mockVideoParticipants={mockVideoParticipants}
          isVideoMuted={isVideoMuted}
          isAudioMuted={isAudioMuted}
        />
      </main>

      <Toolbar
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        screenStream={screenStream}
        isGalleryVisible={isGalleryVisible}
        isSidebarVisible={isSidebarVisible}
        isRecording={isRecording}
        isRecordingPaused={isRecordingPaused}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
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
