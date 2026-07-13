import { pickOutboundVideoTrack } from "@/lib/webrtc/outboundMedia";

export function setStreamTracks(stream, tracks) {
  for (const track of stream.getTracks()) {
    if (!tracks.includes(track)) stream.removeTrack(track);
  }
  for (const track of tracks) {
    if (!stream.getTracks().includes(track)) stream.addTrack(track);
  }
}

export function pickTracksForFocus({
  focusedParticipantId,
  videoParticipants,
  localStream,
  screenStream,
}) {
  const participant =
    focusedParticipantId && focusedParticipantId !== "host"
      ? videoParticipants.find((entry) => entry.id === focusedParticipantId)
      : null;
  if (participant?.stream) {
    return {
      videoTrack:
        participant.stream
          .getVideoTracks()
          .find((track) => track.readyState === "live" && track.enabled) ??
        null,
      audioTrack:
        participant.stream
          .getAudioTracks()
          .find((track) => track.readyState === "live" && track.enabled) ??
        null,
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
  const participant =
    focusedParticipantId && focusedParticipantId !== "host"
      ? videoParticipants.find((entry) => entry.id === focusedParticipantId)
      : null;
  if (participant?.stream) {
    const video = participant.stream
      .getVideoTracks()
      .find((track) => track.readyState === "live");
    const audio = participant.stream
      .getAudioTracks()
      .find((track) => track.readyState === "live");
    return `remote:${focusedParticipantId}:${trackSignature(video)}:${trackSignature(audio)}`;
  }
  const screenVideo = screenStream
    ?.getVideoTracks()
    .find((track) => track.readyState === "live");
  const cameraVideo = localStream
    ?.getVideoTracks()
    .find((track) => track.readyState === "live");
  const mic = localStream
    ?.getAudioTracks()
    .find((track) => track.readyState === "live");
  const screenAudio = screenStream
    ?.getAudioTracks()
    .find((track) => track.readyState === "live");
  return `host:${trackSignature(screenVideo ?? cameraVideo)}:${trackSignature(mic)}:${trackSignature(screenAudio)}`;
}

export function stopActiveRecorders(videoRecorder, audioRecorder) {
  return new Promise((resolve) => {
    let videoStopped = false;
    let audioStopped = false;
    const check = () => {
      if (videoStopped && audioStopped) resolve();
    };
    const stop = (recorder, stream) => {
      const markStopped = () => {
        if (stream === "video") videoStopped = true;
        else audioStopped = true;
      };
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = () => {
          markStopped();
          check();
        };
        recorder.stop();
      } else {
        markStopped();
      }
    };
    stop(videoRecorder, "video");
    stop(audioRecorder, "audio");
    check();
  });
}

export function createRecorder(stream, options) {
  try {
    return new MediaRecorder(stream, options);
  } catch (error) {
    console.warn(
      "Requested recording format is unavailable; using the browser default.",
      error,
    );
    return new MediaRecorder(stream);
  }
}

export function selectRecordingFormat(candidates, fallback) {
  return (
    candidates.find((candidate) =>
      MediaRecorder.isTypeSupported(candidate.mimeType),
    ) ?? fallback
  );
}
