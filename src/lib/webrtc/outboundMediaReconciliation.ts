export function needsMediaRenegotiation(
  call,
  {
    hasVideoTrack,
    hasAudioTrack,
  }: { hasVideoTrack?: any; hasAudioTrack?: any },
) {
  const senders = call?.peerConnection?.getSenders?.() ?? [];
  const hasVideoSender = senders.some(
    (sender) =>
      (sender._hostPresentKind ?? sender.track?.kind) === "video" &&
      sender.track,
  );
  const hasAudioSender = senders.some(
    (sender) =>
      (sender._hostPresentKind ?? sender.track?.kind) === "audio" &&
      sender.track,
  );
  return (
    (hasVideoTrack && !hasVideoSender) || (hasAudioTrack && !hasAudioSender)
  );
}
