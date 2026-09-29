import { useEffect, useMemo, useState } from "react";
import { getAutoFocusTargetId } from "../autoFocus";

export function useMeetingFocus({
  focusedParticipantId,
  videoParticipants,
  isHost,
  localIsSpeaking,
  screenStream,
  isVideoMuted,
  hostIsSpeaking,
  hostScreenSharing,
  hostVideoMuted,
}) {
  const AUTO_FOCUS_INACTIVITY_MS = 3000;

  const autoFocusTargetId = useMemo(
    () =>
      getAutoFocusTargetId({
        focusedParticipantId,
        videoParticipants,
        isHost,
        localIsSpeaking,
        localVideoAvailable: Boolean(screenStream) || !isVideoMuted,
        hostIsSpeaking,
        hostVideoAvailable: hostScreenSharing || !hostVideoMuted,
        hostIsScreenSharing: isHost ? Boolean(screenStream) : hostScreenSharing,
      }),
    [
      focusedParticipantId,
      videoParticipants,
      isHost,
      localIsSpeaking,
      screenStream,
      isVideoMuted,
      hostIsSpeaking,
      hostScreenSharing,
      hostVideoMuted,
    ],
  );

  const [effectiveFocusedId, setEffectiveFocusedId] = useState(
    focusedParticipantId || "host",
  );
  const hostIsActivelySpeaking = isHost ? localIsSpeaking : hostIsSpeaking;

  useEffect(() => {
    if (focusedParticipantId !== "") {
      setEffectiveFocusedId(focusedParticipantId);
      return undefined;
    }

    // A host who starts speaking should take the stage immediately. Keep the
    // brief inactivity delay only for the no-one-is-speaking fallback, so the
    // stage does not jump back to the host between short pauses.
    if (autoFocusTargetId !== "host" || hostIsActivelySpeaking) {
      setEffectiveFocusedId(autoFocusTargetId);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setEffectiveFocusedId(autoFocusTargetId);
    }, AUTO_FOCUS_INACTIVITY_MS);

    return () => window.clearTimeout(timer);
  }, [focusedParticipantId, autoFocusTargetId, hostIsActivelySpeaking]);

  return effectiveFocusedId;
}
