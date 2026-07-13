# Recording

This folder owns the browser-local recording feature:

- `Recording.js` coordinates capture, pause/resume, recovery, and delivery.
- `media/` owns canvas rendering, audio mixing, track selection, and recorder
  lifecycle helpers.
- `worker/` owns worker-only support code, including the FFmpeg bridge.
- `recordingStorage.js` persists manifests, five-second fragments, and a
  sequential IndexedDB export fallback when OPFS is unavailable.
- `webCodecsRecording.worker.js` finalizes recordings incrementally, using
  WebCodecs where available and FFmpeg-WASM otherwise.
- `recordingExport.js` streams finalized OPFS files to the selected directory
  or hands a stream/IndexedDB descriptor to the service worker for a
  browser-managed download. Older browsers fall back to a direct OPFS-file
  handoff.
- `RecordingDownloadBanner.*` presents recording and export state.

The FFmpeg runtime assets live at `public/recording/ffmpeg/` because browser
workers must fetch them as static files. They are part of this component's
runtime contract and should move with it if the feature is relocated.
