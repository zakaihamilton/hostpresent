import { selectRecordingFormat } from "../media/recordingMedia";

export function createRecordingFormats() {
  const video = selectRecordingFormat(
    [
      { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
      { mimeType: "video/mp4", extension: "mp4" },
      { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    ],
    { mimeType: "video/webm", extension: "webm" },
  );
  const audio = selectRecordingFormat(
    [
      { mimeType: "audio/mp4", extension: "m4a" },
      { mimeType: "audio/webm;codecs=opus", extension: "webm" },
    ],
    { mimeType: "audio/webm", extension: "webm" },
  );
  return {
    video,
    audio,
    recoveryVideo: selectRecordingFormat(
      [
        { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
        { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
        { mimeType: "video/webm", extension: "webm" },
      ],
      video,
    ),
    recoveryAudio: selectRecordingFormat(
      [
        { mimeType: "audio/webm;codecs=opus", extension: "webm" },
        { mimeType: "audio/webm", extension: "webm" },
      ],
      audio,
    ),
  };
}

export function createSavedRecordingFormats(tracks: {
  video: unknown;
  audio: unknown;
}) {
  return {
    video: tracks.video,
    audio: tracks.audio,
    recoveryVideo: tracks.video,
    recoveryAudio: tracks.audio,
  };
}
