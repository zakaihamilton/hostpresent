"use client";

import { memo, useEffect, useRef } from "react";
import { AUDIO_PLAYBACK_BLOCKED_EVENT } from "@/lib/webrtc/audioPlayback";

export const VideoPlayer = memo(function VideoPlayer({
  stream,
  isMuted = false,
  audioOutputDeviceId = "",
  autoPlay = true,
  className = "",
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const play = () => {
      void video.play().catch((error) => {
        if (
          error?.name === "NotAllowedError" &&
          !video.muted &&
          stream?.getAudioTracks().length
        ) {
          window.dispatchEvent(new Event(AUDIO_PLAYBACK_BLOCKED_EVENT));
        }
      });
    };
    if (stream) {
      video.srcObject = stream;
      play();
    } else {
      video.pause();
      video.srcObject = null;
    }

    const refresh = () => {
      if (!videoRef.current || !stream) return;
      videoRef.current.srcObject = null;
      videoRef.current.srcObject = stream;
      play();
    };

    if (typeof stream?.addEventListener === "function") {
      stream.addEventListener("addtrack", refresh);
      stream.addEventListener("removetrack", refresh);
    }

    return () => {
      if (typeof stream?.removeEventListener === "function") {
        stream.removeEventListener("addtrack", refresh);
        stream.removeEventListener("removetrack", refresh);
      }
      video.pause();
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof video.setSinkId !== "function") return;

    void video.setSinkId(audioOutputDeviceId || "").catch(() => {});
  }, [audioOutputDeviceId]);

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay={autoPlay}
      playsInline
      muted={isMuted}
    />
  );
});
