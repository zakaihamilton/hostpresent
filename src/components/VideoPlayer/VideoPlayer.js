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
    }

    return () => {
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
