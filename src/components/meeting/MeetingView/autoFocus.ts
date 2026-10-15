export function getAutoFocusTargetId({
  focusedParticipantId,
  videoParticipants,
  isHost,
  localIsSpeaking,
  localVideoAvailable,
  hostIsSpeaking,
  hostVideoAvailable,
  hostIsScreenSharing,
}: {
  focusedParticipantId?: any;
  videoParticipants?: any;
  isHost?: any;
  localIsSpeaking?: any;
  localVideoAvailable?: any;
  hostIsSpeaking?: any;
  hostVideoAvailable?: any;
  hostIsScreenSharing?: any;
}) {
  if (focusedParticipantId !== "") return focusedParticipantId;

  if (hostIsScreenSharing) return "host";

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
