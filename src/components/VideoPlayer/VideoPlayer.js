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
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
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
