import { useCallback, useEffect, useRef, useState } from "react";
import { buildRecordingFilename } from "@/lib/recordingFilename";
import {
  clearSavedRecording,
  loadSavedRecording,
  saveRecordingChunk,
  saveRecordingMeta,
} from "@/lib/recordingStorage";
import { createRecordingStateMessage } from "@/lib/signaling/messages";
import { pickOutboundVideoTrack } from "@/lib/webrtc/outboundMedia";

export class CanvasVideoRenderer {
  constructor() {
    if (typeof document !== "undefined") {
      this.canvas = document.createElement("canvas");
      this.canvas.width = 1280;
      this.canvas.height = 720;
      this.ctx = this.canvas.getContext("2d");
      this.videoElement = document.createElement("video");
      this.videoElement.muted = true;
      this.videoElement.playsInline = true;
    }
    this.activeTrack = null;
    this.animationId = null;
    this.running = false;

    this.render = this.render.bind(this);
  }

  setTrack(track) {
    if (this.activeTrack === track) return;
    this.activeTrack = track;

    if (track && typeof MediaStream !== "undefined") {
      const stream = new MediaStream([track]);
      this.videoElement.srcObject = stream;
      this.videoElement
        .play()
        .catch((err) => console.warn("Canvas video play failed:", err));
    } else if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.render();
  }

  stop() {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  render() {
    if (!this.running) return;

    if (this.videoElement && this.videoElement.readyState >= 2) {
      this.resizeToSource();
      this.ctx.drawImage(
        this.videoElement,
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );
    } else if (this.ctx) {
      this.ctx.fillStyle = "#1e1e24";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    this.animationId = requestAnimationFrame(this.render);
  }

  resizeToSource() {
    const { videoWidth, videoHeight } = this.videoElement;
    if (!videoWidth || !videoHeight) return;

    const scale = Math.min(1, 1920 / Math.max(videoWidth, videoHeight));
    const width = Math.max(2, Math.floor((videoWidth * scale) / 2) * 2);
    const height = Math.max(2, Math.floor((videoHeight * scale) / 2) * 2);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  getStream() {
    if (this.canvas?.captureStream) {
      return this.canvas.captureStream(30);
    }
    return new MediaStream();
  }
}

export class RecordingAudioMixer {
  constructor() {
    const AudioContextConstructor =
      typeof window !== "undefined" &&
      (window.AudioContext || window.webkitAudioContext);
    if (AudioContextConstructor) {
      this.context = new AudioContextConstructor();
      this.destination = this.context.createMediaStreamDestination();
    }
    this.sources = new Map();
  }

  updateTracks(tracks) {
    if (!this.context) return;

    // Disconnect removed tracks
    for (const [trackId, info] of this.sources.entries()) {
      if (!tracks.some((t) => t.id === trackId && t.readyState === "live")) {
        try {
          info.sourceNode.disconnect();
        } catch {}
        this.sources.delete(trackId);
      }
    }

    // Connect new tracks
    for (const track of tracks) {
      if (!track || track.readyState !== "live") continue;
      if (this.sources.has(track.id)) continue;

      try {
        const stream = new MediaStream([track]);
        const sourceNode = this.context.createMediaStreamSource(stream);
        sourceNode.connect(this.destination);
        this.sources.set(track.id, { sourceNode, stream });
      } catch (err) {
        console.warn("Failed to connect audio track to recording mixer:", err);
      }
    }
  }

  getAudioTrack() {
    return this.destination?.stream.getAudioTracks()[0] ?? null;
  }

  destroy() {
    for (const info of this.sources.values()) {
      try {
        info.sourceNode.disconnect();
      } catch {}
    }
    this.sources.clear();
    if (this.context && this.context.state !== "closed") {
      void this.context.close();
    }
  }
}

function setStreamTracks(stream, tracks) {
  const currentTracks = stream.getTracks();
  for (const track of currentTracks) {
    if (!tracks.includes(track)) {
      stream.removeTrack(track);
    }
  }
  for (const track of tracks) {
    if (!currentTracks.includes(track)) {
      stream.addTrack(track);
    }
  }
}

function pickTracksForFocus({
  focusedParticipantId,
  videoParticipants,
  localStream,
  screenStream,
}) {
  const focusedParticipant =
    focusedParticipantId && focusedParticipantId !== "host"
      ? videoParticipants.find((p) => p.id === focusedParticipantId)
      : null;

  if (focusedParticipant?.stream) {
    return {
      videoTrack:
        focusedParticipant.stream
          .getVideoTracks()
          .find((t) => t.readyState === "live" && t.enabled) ?? null,
      audioTrack:
        focusedParticipant.stream
          .getAudioTracks()
          .find((t) => t.readyState === "live" && t.enabled) ?? null,
    };
  }

  return {
    videoTrack: pickOutboundVideoTrack(localStream, screenStream),
    audioTrack: null,
  };
}

function trackSignature(track) {
  if (!track || track.readyState !== "live") return "";
  return `${track.id}:${track.enabled ? "1" : "0"}`;
}

export function getRecordingMediaSignature({
  focusedParticipantId,
  videoParticipants,
  localStream,
  screenStream,
}) {
  const focusedParticipant =
    focusedParticipantId && focusedParticipantId !== "host"
      ? videoParticipants.find((p) => p.id === focusedParticipantId)
      : null;

  if (focusedParticipant?.stream) {
    const videoTrack = focusedParticipant.stream
      .getVideoTracks()
      .find((track) => track.readyState === "live");
    const audioTrack = focusedParticipant.stream
      .getAudioTracks()
      .find((track) => track.readyState === "live");
    return `remote:${focusedParticipantId}:${trackSignature(videoTrack)}:${trackSignature(audioTrack)}`;
  }

  const screenVideo = screenStream
    ?.getVideoTracks()
    .find((track) => track.readyState === "live");
  const cameraVideo = localStream
    ?.getVideoTracks()
    .find((track) => track.readyState === "live");
  const videoTrack = screenVideo ?? cameraVideo;
  const micTrack = localStream
    ?.getAudioTracks()
    .find((track) => track.readyState === "live");
  const screenAudio = screenStream
    ?.getAudioTracks()
    .find((track) => track.readyState === "live");

  return `host:${trackSignature(videoTrack)}:${trackSignature(micTrack)}:${trackSignature(screenAudio)}`;
}

function stopActiveRecorders(videoRecorder, audioRecorder) {
  return new Promise((resolve) => {
    let videoStopped = false;
    let audioStopped = false;

    const checkResolve = () => {
      if (videoStopped && audioStopped) {
        resolve();
      }
    };

    if (videoRecorder && videoRecorder.state !== "inactive") {
      videoRecorder.onstop = () => {
        videoStopped = true;
        checkResolve();
      };
      videoRecorder.stop();
    } else {
      videoStopped = true;
    }

    if (audioRecorder && audioRecorder.state !== "inactive") {
      audioRecorder.onstop = () => {
        audioStopped = true;
        checkResolve();
      };
      audioRecorder.stop();
    } else {
      audioStopped = true;
    }

    checkResolve();
  });
}

function createRecorder(stream, options) {
  let recorder;
  try {
    recorder = new MediaRecorder(stream, options);
  } catch (e) {
    console.warn(
      "MP4 format not fully supported by browser, falling back to default.",
      e,
    );
    recorder = new MediaRecorder(stream);
  }
  return recorder;
}

export function Recording({
  isHost,
  roomConnection,
  localStream,
  screenStream,
  videoParticipants = [],
  focusedParticipantId = "host",
  resetRecordingTimer,
  isRecording,
  setIsRecording,
  isRecordingPaused,
  setIsRecordingPaused,
  sessionName = "",
}) {
  const [downloadState, setDownloadState] = useState(null);
  const [savedRecording, setSavedRecording] = useState(null);
  const [_remoteTrackRevision, setRemoteTrackRevision] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const audioChunksRef = useRef([]);
  const compositeStreamRef = useRef(null);
  const downloadDismissTimerRef = useRef(null);
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;
  const screenStreamRef = useRef(screenStream);
  screenStreamRef.current = screenStream;
  const videoParticipantsRef = useRef(videoParticipants);
  videoParticipantsRef.current = videoParticipants;

  const canvasRendererRef = useRef(null);
  const audioMixerRef = useRef(null);

  const focusedIdRef = useRef(focusedParticipantId);
  focusedIdRef.current = focusedParticipantId;
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;
  const chunkIndexRef = useRef(0);

  const publishRecordingState = useCallback(
    (active, paused = false) => {
      if (!isHost) return;
      roomConnection?.send(createRecordingStateMessage({ active, paused }));
    },
    [isHost, roomConnection],
  );

  useEffect(() => {
    if (!isHost || !isRecording) return;
    publishRecordingState(true, isRecordingPaused);
  }, [isHost, isRecording, isRecordingPaused, publishRecordingState]);

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

  const sessionNameRef = useRef(sessionName);
  sessionNameRef.current = sessionName;

  const finalizeRecordingDownload = useCallback(async () => {
    const filename = buildRecordingFilename({
      sessionName: sessionNameRef.current,
    });
    const audioFilename = buildRecordingFilename({
      sessionName: sessionNameRef.current,
      extension: "m4a",
    });
    const chunks = recordingChunksRef.current;
    const chunkCount = chunks.length;

    updateDownloadProgress("building", 15, filename);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    for (let index = 0; index < chunkCount; index += 1) {
      const progress =
        15 + Math.round(((index + 1) / Math.max(chunkCount, 1)) * 55);
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

    const audioChunks = audioChunksRef.current;
    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, {
        type: audioChunks[0].type || "audio/mp4",
      });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audioAnchor = document.createElement("a");
      audioAnchor.style.display = "none";
      audioAnchor.href = audioUrl;
      audioAnchor.download = audioFilename;
      document.body.appendChild(audioAnchor);
      audioAnchor.click();
      setTimeout(() => {
        document.body.removeChild(audioAnchor);
        window.URL.revokeObjectURL(audioUrl);
      }, 100);
    }

    recordingChunksRef.current = [];
    audioChunksRef.current = [];
    chunkIndexRef.current = 0;
    updateDownloadProgress("complete", 100, filename);
    clearSavedRecording().catch(() => {});

    downloadDismissTimerRef.current = setTimeout(() => {
      setDownloadState(null);
      downloadDismissTimerRef.current = null;
    }, 5000);
  }, [updateDownloadProgress]);

  const rebuildRecorder = useCallback(async () => {
    if (!canvasRendererRef.current) {
      canvasRendererRef.current = new CanvasVideoRenderer();
      canvasRendererRef.current.start();
    }
    if (!audioMixerRef.current) {
      audioMixerRef.current = new RecordingAudioMixer();
    }

    const { videoTrack } = pickTracksForFocus({
      focusedParticipantId: focusedIdRef.current,
      videoParticipants: videoParticipantsRef.current,
      localStream: localStreamRef.current,
      screenStream: screenStreamRef.current,
    });
    canvasRendererRef.current.setTrack(videoTrack);

    const micTrack = localStreamRef.current
      ?.getAudioTracks()
      .find((t) => t.readyState === "live");
    const screenAudio = screenStreamRef.current
      ?.getAudioTracks()
      .find((t) => t.readyState === "live");
    const remoteAudioTracks = videoParticipantsRef.current
      .map((p) =>
        p.stream?.getAudioTracks().find((t) => t.readyState === "live"),
      )
      .filter(Boolean);

    const allAudioTracks = [micTrack, screenAudio, ...remoteAudioTracks].filter(
      Boolean,
    );
    audioMixerRef.current.updateTracks(allAudioTracks);

    const recVideoTrack = canvasRendererRef.current
      .getStream()
      .getVideoTracks()[0];
    const recAudioTrack = audioMixerRef.current.getAudioTrack();

    const tracksToRecord = [recVideoTrack, recAudioTrack].filter(Boolean);
    if (!compositeStreamRef.current) {
      compositeStreamRef.current = new MediaStream(tracksToRecord);
    } else {
      setStreamTracks(compositeStreamRef.current, tracksToRecord);
    }

    let options = { mimeType: "video/mp4;codecs=avc1" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/mp4" };
    }

    const recorder = createRecorder(compositeStreamRef.current, options);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        recordingChunksRef.current.push(event.data);
        const idx = chunkIndexRef.current;
        chunkIndexRef.current = idx + 1;
        saveRecordingChunk(idx, event.data).catch(() => {});
        saveRecordingMeta({
          chunkCount: idx + 1,
          sessionName: sessionNameRef.current,
          mimeType: "video/mp4",
          timestamp: Date.now(),
        }).catch(() => {});
      }
    };

    if (recAudioTrack) {
      let audioOptions = { mimeType: "audio/mp4" };
      if (!MediaRecorder.isTypeSupported(audioOptions.mimeType)) {
        audioOptions = {};
      }
      const audioRecorder = createRecorder(
        new MediaStream([recAudioTrack]),
        audioOptions,
      );
      audioRecorderRef.current = audioRecorder;
      audioRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      audioRecorder.start(1000);
    } else {
      audioRecorderRef.current = null;
    }

    recorder.start(1000);
  }, []);

  const startRecording = useCallback(async () => {
    if (!isHost) return;

    recordingChunksRef.current = [];
    audioChunksRef.current = [];
    chunkIndexRef.current = 0;
    setSavedRecording(null);
    clearSavedRecording().catch(() => {});

    await rebuildRecorder();

    resetRecordingTimer();
    setIsRecording(true);
    setIsRecordingPaused(false);
    publishRecordingState(true, false);
  }, [
    isHost,
    rebuildRecorder,
    resetRecordingTimer,
    publishRecordingState,
    setIsRecording,
    setIsRecordingPaused,
  ]);

  const pauseRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      if (audioRecorderRef.current?.state === "recording") {
        audioRecorderRef.current.pause();
      }
      setIsRecordingPaused(true);
      publishRecordingState(true, true);
    }
  }, [publishRecordingState, setIsRecordingPaused]);

  const resumeRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      if (audioRecorderRef.current?.state === "paused") {
        audioRecorderRef.current.resume();
      }
      setIsRecordingPaused(false);
      publishRecordingState(true, false);
    }
  }, [publishRecordingState, setIsRecordingPaused]);

  const stopRecording = useCallback(() => {
    if (!isHost) return;

    setIsRecording(false);
    setIsRecordingPaused(false);
    resetRecordingTimer();
    publishRecordingState(false, false);

    const recorder = mediaRecorderRef.current;
    const hasActiveRecorder = recorder && recorder.state !== "inactive";
    const audioRecorder = audioRecorderRef.current;
    const hasActiveAudioRecorder =
      audioRecorder && audioRecorder.state !== "inactive";

    if (hasActiveRecorder || hasActiveAudioRecorder) {
      updateDownloadProgress("preparing", 5);
      void stopActiveRecorders(recorder, audioRecorder).then(() => {
        canvasRendererRef.current?.stop();
        canvasRendererRef.current = null;
        audioMixerRef.current?.destroy();
        audioMixerRef.current = null;
        void finalizeRecordingDownload();
      });
      return;
    }

    if (recordingChunksRef.current.length > 0) {
      updateDownloadProgress("preparing", 5);
      canvasRendererRef.current?.stop();
      canvasRendererRef.current = null;
      audioMixerRef.current?.destroy();
      audioMixerRef.current = null;
      void finalizeRecordingDownload();
    }
  }, [
    finalizeRecordingDownload,
    isHost,
    resetRecordingTimer,
    publishRecordingState,
    updateDownloadProgress,
    setIsRecording,
    setIsRecordingPaused,
  ]);

  const stopRecordingAsync = useCallback(async () => {
    if (!isHost) return;

    const recorder = mediaRecorderRef.current;
    const hasActiveRecorder = recorder && recorder.state !== "inactive";
    const audioRecorder = audioRecorderRef.current;
    const hasActiveAudioRecorder =
      audioRecorder && audioRecorder.state !== "inactive";

    if (!hasActiveRecorder && !hasActiveAudioRecorder) {
      setIsRecording(false);
      setIsRecordingPaused(false);
      resetRecordingTimer();
      publishRecordingState(false, false);
      if (recordingChunksRef.current.length > 0) {
        updateDownloadProgress("preparing", 5);
        canvasRendererRef.current?.stop();
        canvasRendererRef.current = null;
        audioMixerRef.current?.destroy();
        audioMixerRef.current = null;
        await finalizeRecordingDownload();
      }
      return;
    }

    updateDownloadProgress("preparing", 5);
    await stopActiveRecorders(recorder, audioRecorder);
    canvasRendererRef.current?.stop();
    canvasRendererRef.current = null;
    audioMixerRef.current?.destroy();
    audioMixerRef.current = null;
    await finalizeRecordingDownload();
    setIsRecording(false);
    setIsRecordingPaused(false);
    resetRecordingTimer();
    publishRecordingState(false, false);
  }, [
    finalizeRecordingDownload,
    isHost,
    resetRecordingTimer,
    publishRecordingState,
    updateDownloadProgress,
    setIsRecording,
    setIsRecordingPaused,
  ]);

  useEffect(() => {
    if (!isHost || !isRecording) return undefined;
    if (!focusedParticipantId || focusedParticipantId === "host") {
      return undefined;
    }

    const participant = videoParticipantsRef.current.find(
      (entry) => entry.id === focusedParticipantId,
    );
    const stream = participant?.stream;
    if (!stream || typeof stream.addEventListener !== "function") {
      return undefined;
    }

    const handleTrackChange = () => {
      setRemoteTrackRevision((revision) => revision + 1);
    };

    stream.addEventListener("addtrack", handleTrackChange);
    stream.addEventListener("removetrack", handleTrackChange);

    return () => {
      stream.removeEventListener("addtrack", handleTrackChange);
      stream.removeEventListener("removetrack", handleTrackChange);
    };
  }, [focusedParticipantId, isHost, isRecording]);

  useEffect(() => {
    if (!isHost || !isRecording) return;

    const { videoTrack } = pickTracksForFocus({
      focusedParticipantId,
      videoParticipants,
      localStream,
      screenStream,
    });
    canvasRendererRef.current?.setTrack(videoTrack);

    const micTrack = localStream
      ?.getAudioTracks()
      .find((t) => t.readyState === "live");
    const screenAudio = screenStream
      ?.getAudioTracks()
      .find((t) => t.readyState === "live");
    const remoteAudioTracks = videoParticipants
      .map((p) =>
        p.stream?.getAudioTracks().find((t) => t.readyState === "live"),
      )
      .filter(Boolean);

    const allAudioTracks = [micTrack, screenAudio, ...remoteAudioTracks].filter(
      Boolean,
    );
    audioMixerRef.current?.updateTracks(allAudioTracks);
  }, [
    isHost,
    isRecording,
    focusedParticipantId,
    videoParticipants,
    localStream,
    screenStream,
  ]);

  useEffect(() => {
    if (!isHost || !isRecording) return;

    const handleUnload = () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      const audioRecorder = audioRecorderRef.current;
      if (audioRecorder && audioRecorder.state !== "inactive") {
        audioRecorder.stop();
      }
      const meta = {
        chunkCount: chunkIndexRef.current,
        sessionName: sessionNameRef.current,
        mimeType: "video/mp4",
        timestamp: Date.now(),
      };
      saveRecordingMeta(meta).catch(() => {});
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [isHost, isRecording]);

  useEffect(() => {
    let cancelled = false;
    loadSavedRecording().then((saved) => {
      if (cancelled || !saved) return;
      setSavedRecording(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownloadSavedRecording = useCallback(() => {
    const saved = savedRecording;
    if (!saved) return;
    const blob = new Blob(saved.chunks, { type: saved.meta.mimeType });
    const filename = buildRecordingFilename({
      sessionName: saved.meta.sessionName,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    clearSavedRecording().catch(() => {});
    setSavedRecording(null);
  }, [savedRecording]);

  const handleDiscardSavedRecording = useCallback(() => {
    clearSavedRecording().catch(() => {});
    setSavedRecording(null);
  }, []);

  return {
    downloadState,
    savedRecording,
    dismissDownloadBanner,
    downloadSavedRecording: handleDownloadSavedRecording,
    discardSavedRecording: handleDiscardSavedRecording,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    stopRecordingAsync,
    publishRecordingState,
  };
}
