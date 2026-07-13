export function getAutoFocusTargetId({
  focusedParticipantId,
  videoParticipants,
  isHost,
  localIsSpeaking,
  localVideoAvailable,
  hostIsSpeaking,
  hostVideoAvailable,
}) {
  if (focusedParticipantId !== "") return focusedParticipantId;

  const speaker = videoParticipants.find(
    (participant) =>
      participant.isSpeaking &&
      (participant.isScreenSharing || !participant.isVideoMuted),
  );
  if (speaker) return speaker.id;

  if (isHost && localIsSpeaking && localVideoAvailable) return "host";
  if (!isHost && hostIsSpeaking && hostVideoAvailable) return "host";

  return "host";
}
