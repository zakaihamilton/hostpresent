import { useEffect, useState } from "react";
import {
  closeActiveRecordingSegment,
  updateRecordingSession,
} from "@/components/meeting/Recording/recordingStorage";
import { pickTracksForFocus } from "../media/recordingMedia";

export function useRecordingTrackSync({
  isHost,
  isRecording,
  localStream,
  screenStream,
  videoParticipants,
  focusedParticipantId,
  localTrackRevision,
  canvasRendererRef,
  audioMixerRef,
  webCodecsWorkerRef,
  mediaRecorderRef,
  audioRecorderRef,
  liveCaptureStopTimerRef,
}: {
  isHost?: any;
  isRecording?: any;
  localStream?: any;
  screenStream?: any;
  videoParticipants?: any[];
  focusedParticipantId?: any;
  localTrackRevision?: any;
  canvasRendererRef: { current: any };
  audioMixerRef: { current: any };
  webCodecsWorkerRef: { current: any };
  mediaRecorderRef: { current: any };
  audioRecorderRef: { current: any };
  liveCaptureStopTimerRef: { current: any };
}) {
  const [trackRevision, setTrackRevision] = useState(0);

  useEffect(() => {
    if (!isHost || !isRecording) return undefined;
    const streams = new Set([
      localStream,
      screenStream,
      ...videoParticipants.map((participant) => participant.stream),
    ]);
    const handleTrackChange = () =>
      setTrackRevision((revision) => revision + 1);
    for (const stream of streams) {
      stream?.addEventListener?.("addtrack", handleTrackChange);
      stream?.addEventListener?.("removetrack", handleTrackChange);
    }
    return () => {
      for (const stream of streams) {
        stream?.removeEventListener?.("addtrack", handleTrackChange);
        stream?.removeEventListener?.("removetrack", handleTrackChange);
      }
    };
  }, [isHost, isRecording, localStream, screenStream, videoParticipants]);

  useEffect(() => {
    if (!isHost || !isRecording) return;

    const { videoTrack } = pickTracksForFocus({
      focusedParticipantId,
      videoParticipants,
      localStream,
      screenStream,
    });
    // Track events can change a MediaStream without changing its identity.
    void trackRevision;
    void localTrackRevision;
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
    trackRevision,
    localTrackRevision,
    canvasRendererRef,
    audioMixerRef,
  ]);

  useEffect(() => {
    if (!isHost || !isRecording) return;

    const handleUnload = () => {
      if (webCodecsWorkerRef.current) {
        webCodecsWorkerRef.current.postMessage({ type: "stop" });
      }
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      const audioRecorder = audioRecorderRef.current;
      if (audioRecorder && audioRecorder.state !== "inactive") {
        audioRecorder.stop();
      }
      Promise.all([
        closeActiveRecordingSegment("unload"),
        updateRecordingSession({ status: "interrupted" }),
      ]).catch(() => {});
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [
    isHost,
    isRecording,
    webCodecsWorkerRef,
    mediaRecorderRef,
    audioRecorderRef,
  ]);

  useEffect(
    () => () => {
      if (liveCaptureStopTimerRef.current) {
        clearTimeout(liveCaptureStopTimerRef.current);
      }
    },
    [liveCaptureStopTimerRef],
  );
}
