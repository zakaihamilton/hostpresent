import { useCallback, useEffect, useMemo } from "react";
import {
  createHostMuteAllAudioMessage,
  createHostMuteAllVideoMessage,
  createHostMuteAudioMessage,
  createHostMuteVideoMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";

function getParticipantName({
  participantId,
  participantType,
  videoParticipants,
  audioList,
}) {
  if (participantType === "video") {
    return (
      videoParticipants.find((participant) => participant.id === participantId)
        ?.name ?? "this participant"
    );
  }

  return (
    audioList.find((participant) => participant.id === participantId)?.name ??
    "this participant"
  );
}

export function useHostControls({
  videoParticipants,
  audioList,
  setVideoParticipants,
  setAudioList,
  signaling,
  confirm,
  enabled = true,
}) {
  const applyParticipantAudioMuted = useCallback(
    (participantId, participantType) => {
      if (participantType === "video") {
        setVideoParticipants((prev) =>
          prev.map((participant) =>
            participant.id === participantId
              ? { ...participant, isAudioMuted: true }
              : participant,
          ),
        );
        return;
      }

      setAudioList((prev) =>
        prev.map((participant) =>
          participant.id === participantId
            ? { ...participant, isMuted: true }
            : participant,
        ),
      );
    },
    [setAudioList, setVideoParticipants],
  );

  const applyParticipantVideoMuted = useCallback(
    (participantId) => {
      setVideoParticipants((prev) =>
        prev.map((participant) =>
          participant.id === participantId
            ? { ...participant, isVideoMuted: true }
            : participant,
        ),
      );
    },
    [setVideoParticipants],
  );

  const applyParticipantAudioUnmuted = useCallback(
    (participantId, participantType) => {
      if (participantType === "video") {
        setVideoParticipants((prev) =>
          prev.map((participant) =>
            participant.id === participantId
              ? { ...participant, isAudioMuted: false }
              : participant,
          ),
        );
        return;
      }

      setAudioList((prev) =>
        prev.map((participant) =>
          participant.id === participantId
            ? { ...participant, isMuted: false }
            : participant,
        ),
      );
    },
    [setAudioList, setVideoParticipants],
  );

  const applyParticipantVideoUnmuted = useCallback(
    (participantId) => {
      setVideoParticipants((prev) =>
        prev.map((participant) =>
          participant.id === participantId
            ? { ...participant, isVideoMuted: false }
            : participant,
        ),
      );
    },
    [setVideoParticipants],
  );

  const applyMuteAllAudio = useCallback(() => {
    setVideoParticipants((prev) =>
      prev.map((participant) => ({ ...participant, isAudioMuted: true })),
    );
    setAudioList((prev) =>
      prev.map((participant) => ({ ...participant, isMuted: true })),
    );
  }, [setAudioList, setVideoParticipants]);

  const applyMuteAllVideo = useCallback(() => {
    setVideoParticipants((prev) =>
      prev.map((participant) => ({ ...participant, isVideoMuted: true })),
    );
  }, [setVideoParticipants]);

  const muteParticipantAudio = useCallback(
    async (participantId, participantType) => {
      if (!enabled) return;
      const participantName = getParticipantName({
        participantId,
        participantType,
        videoParticipants,
        audioList,
      });

      const alreadyMuted =
        participantType === "video"
          ? videoParticipants.find(
              (participant) => participant.id === participantId,
            )?.isAudioMuted
          : audioList.find((participant) => participant.id === participantId)
              ?.isMuted;

      if (alreadyMuted) return;

      const confirmed = await confirm({
        title: "Mute participant",
        message: `Mute ${participantName}'s microphone? They can unmute themselves when ready.`,
        confirmLabel: "Mute",
        cancelLabel: "Cancel",
        variant: "danger",
      });

      if (!confirmed) return;

      applyParticipantAudioMuted(participantId, participantType);
      signaling.send(
        createHostMuteAudioMessage({ participantId, participantType }),
      ).catch(() => {});
    },
    [
      applyParticipantAudioMuted,
      audioList,
      confirm,
      enabled,
      videoParticipants,
      signaling,
    ],
  );

  const muteParticipantVideo = useCallback(
    async (participantId) => {
      if (!enabled) return;
      const participantName = getParticipantName({
        participantId,
        participantType: "video",
        videoParticipants,
        audioList,
      });

      const alreadyMuted = videoParticipants.find(
        (participant) => participant.id === participantId,
      )?.isVideoMuted;

      if (alreadyMuted) return;

      const confirmed = await confirm({
        title: "Turn off camera",
        message: `Turn off ${participantName}'s camera? They can turn it back on when ready.`,
        confirmLabel: "Turn off camera",
        cancelLabel: "Cancel",
        variant: "danger",
      });

      if (!confirmed) return;

      applyParticipantVideoMuted(participantId);
      signaling.send(createHostMuteVideoMessage({ participantId })).catch(() => {});
    },
    [
      applyParticipantVideoMuted,
      audioList,
      confirm,
      enabled,
      videoParticipants,
      signaling,
    ],
  );

  const muteAllAudio = useCallback(async () => {
    if (!enabled) return;
    const unmutedCount =
      videoParticipants.filter((participant) => !participant.isAudioMuted)
        .length +
      audioList.filter((participant) => !participant.isMuted).length;

    if (unmutedCount === 0) return;

    const confirmed = await confirm({
      title: "Mute all participants",
      message: `Mute all ${unmutedCount} unmuted participants? They can unmute themselves when ready.`,
      confirmLabel: "Mute all",
      cancelLabel: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    applyMuteAllAudio();
    signaling.send(createHostMuteAllAudioMessage()).catch(() => {});
  }, [
    applyMuteAllAudio,
    audioList,
    confirm,
    enabled,
    videoParticipants,
    signaling,
  ]);

  const muteAllVideo = useCallback(async () => {
    if (!enabled) return;
    const unmutedCount = videoParticipants.filter(
      (participant) => !participant.isVideoMuted,
    ).length;

    if (unmutedCount === 0) return;

    const confirmed = await confirm({
      title: "Turn off all cameras",
      message: `Turn off cameras for all ${unmutedCount} video participants? They can turn them back on when ready.`,
      confirmLabel: "Turn off all",
      cancelLabel: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    applyMuteAllVideo();
    signaling.send(createHostMuteAllVideoMessage()).catch(() => {});
  }, [applyMuteAllVideo, confirm, enabled, videoParticipants, signaling]);

  useEffect(() => {
    if (!enabled) return undefined;

    return signaling.subscribe((message) => {
      switch (message.type) {
        case SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED:
          applyParticipantAudioMuted(
            message.participantId,
            message.participantType,
          );
          break;
        case SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED:
          applyParticipantVideoMuted(message.participantId);
          break;
        case SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED:
          applyParticipantAudioUnmuted(
            message.participantId,
            message.participantType,
          );
          break;
        case SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED:
          applyParticipantVideoUnmuted(message.participantId);
          break;
        default:
          break;
      }
    });
  }, [
    applyParticipantAudioMuted,
    applyParticipantAudioUnmuted,
    applyParticipantVideoMuted,
    applyParticipantVideoUnmuted,
    enabled,
    signaling,
  ]);

  const canMuteAllAudio = useMemo(
    () =>
      enabled &&
      (videoParticipants.some((participant) => !participant.isAudioMuted) ||
        audioList.some((participant) => !participant.isMuted)),
    [audioList, enabled, videoParticipants],
  );

  const canMuteAllVideo = useMemo(
    () =>
      enabled &&
      videoParticipants.some((participant) => !participant.isVideoMuted),
    [enabled, videoParticipants],
  );

  return {
    muteParticipantAudio,
    muteParticipantVideo,
    muteAllAudio,
    muteAllVideo,
    canMuteAllAudio,
    canMuteAllVideo,
  };
}
