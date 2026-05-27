"use client";

import { useEffect, useRef } from "react";

export function VideoPlayer({
  stream,
  isMuted = false,
  autoPlay = true,
  className = "",
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    } else {
      video.pause();
      video.srcObject = null;
    }

    const refresh = () => {
      if (!videoRef.current || !stream) return;
      videoRef.current.srcObject = null;
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => {});
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

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay={autoPlay}
      playsInline
      muted={isMuted}
    />
  );
}
