export function isRemoteTrackMuted(track) {
  if (!track) return false;
  return track.muted || !track.enabled || track.readyState !== "live";
}

export function readRemoteStreamMediaState(stream) {
  const audioTrack = stream?.getAudioTracks?.()[0];
  const videoTrack = stream?.getVideoTracks?.()[0];

  return {
    isAudioMuted: audioTrack ? isRemoteTrackMuted(audioTrack) : null,
    isVideoMuted: videoTrack ? isRemoteTrackMuted(videoTrack) : null,
  };
}

export function attachRemoteStreamMediaListeners(stream, onChange) {
  if (!stream || typeof onChange !== "function") {
    return () => {};
  }

  const sync = () => {
    onChange(readRemoteStreamMediaState(stream));
  };

  sync();

  const trackCleanups = [];
  const bindTrack = (track) => {
    track.addEventListener("mute", sync);
    track.addEventListener("unmute", sync);
    track.addEventListener("ended", sync);
    trackCleanups.push(() => {
      track.removeEventListener("mute", sync);
      track.removeEventListener("unmute", sync);
      track.removeEventListener("ended", sync);
    });
  };

  for (const track of stream.getTracks()) {
    bindTrack(track);
  }

  const handleAddTrack = (event) => {
    bindTrack(event.track);
    sync();
  };

  stream.addEventListener("addtrack", handleAddTrack);
  stream.addEventListener("removetrack", sync);

  return () => {
    stream.removeEventListener("addtrack", handleAddTrack);
    stream.removeEventListener("removetrack", sync);
    trackCleanups.forEach((cleanup) => cleanup());
  };
}
