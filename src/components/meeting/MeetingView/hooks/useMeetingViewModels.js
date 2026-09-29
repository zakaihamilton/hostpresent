import { useMemo } from "react";

export function useMeetingViewModels({
  isHost,
  videoParticipants,
  audioList,
  peerParticipants,
  hostDisplayName,
  effectiveFocusedId,
  roomConnection,
  hostStream,
  hostAudioMuted,
  hostVideoMuted,
  hostScreenSharing,
  hostIsSpeaking,
  hostStreamPlaybackMuted,
  localStream,
  screenStream,
  isScreenAudioShared,
  isAudioMuted,
  resolvedDisplayName,
}) {
  const chatParticipants = useMemo(() => {
    const list = [];
    if (isHost) {
      for (const participant of videoParticipants) {
        list.push({ id: participant.id, name: participant.name || "Guest" });
      }
      for (const participant of audioList) {
        list.push({ id: participant.id, name: participant.name || "Guest" });
      }
    } else {
      if (hostDisplayName) {
        list.push({ id: "host", name: hostDisplayName });
      }
      for (const participant of peerParticipants) {
        list.push({ id: participant.id, name: participant.name || "Guest" });
      }
    }
    return list;
  }, [isHost, videoParticipants, audioList, hostDisplayName, peerParticipants]);

  const galleryParticipants = useMemo(() => {
    if (isHost) return videoParticipants;

    const nameById = new Map(
      peerParticipants.map((participant) => [participant.id, participant.name]),
    );
    const localId = roomConnection?.localParticipantId;
    const tiles = [];

    if (hostStream) {
      tiles.push({
        id: "host",
        name: hostDisplayName,
        stream: hostStream,
        isAudioMuted: hostAudioMuted,
        isVideoMuted: hostVideoMuted,
        isScreenSharing: hostScreenSharing,
        isSpeaking: hostIsSpeaking,
        avatarColor: "#6366f1",
      });
    }

    for (const participant of videoParticipants) {
      if (participant.id === localId) continue;
      tiles.push({
        ...participant,
        name: nameById.get(participant.id) || participant.name,
      });
    }

    return tiles;
  }, [
    hostAudioMuted,
    hostDisplayName,
    hostIsSpeaking,
    hostStream,
    hostVideoMuted,
    hostScreenSharing,
    isHost,
    peerParticipants,
    roomConnection?.localParticipantId,
    videoParticipants,
  ]);

  const primaryViewProps = useMemo(() => {
    const focusedParticipant =
      effectiveFocusedId && effectiveFocusedId !== "host"
        ? videoParticipants.find(
            (participant) => participant.id === effectiveFocusedId,
          )
        : null;
    const focusedIsSelf =
      !isHost &&
      effectiveFocusedId &&
      effectiveFocusedId === roomConnection?.localParticipantId;
    const viewingFocusedParticipant = Boolean(
      focusedParticipant || focusedIsSelf,
    );
    const viewingHostStream =
      !viewingFocusedParticipant && !isHost && Boolean(hostStream);
    const activeMain = focusedIsSelf
      ? screenStream || localStream
      : focusedParticipant?.stream || screenStream || localStream;
    const isLocalCamera =
      !viewingHostStream &&
      !screenStream &&
      (focusedIsSelf || !focusedParticipant);

    return {
      stream: viewingHostStream ? hostStream : activeMain,
      isMirrored: isLocalCamera,
      label: viewingFocusedParticipant
        ? focusedIsSelf
          ? screenStream
            ? "You are sharing your screen"
            : resolvedDisplayName
          : focusedParticipant.isScreenSharing
            ? `${focusedParticipant.name} is sharing a screen`
            : focusedParticipant.name
        : viewingHostStream
          ? hostScreenSharing
            ? `${hostDisplayName} is sharing a screen`
            : hostDisplayName
          : screenStream
            ? isScreenAudioShared
              ? "You are sharing your screen with audio"
              : "You are sharing your screen"
            : resolvedDisplayName,
      isMuted: viewingHostStream
        ? hostStreamPlaybackMuted
        : focusedParticipant
          ? focusedParticipant.isSelf || !focusedParticipant.stream
          : screenStream
            ? !isScreenAudioShared
            : true,
      isAudioMuted: viewingHostStream
        ? hostAudioMuted
        : focusedParticipant
          ? focusedParticipant.isAudioMuted
          : isAudioMuted,
      isVideoMuted: viewingHostStream
        ? hostVideoMuted && !hostScreenSharing
        : focusedParticipant
          ? focusedParticipant.isVideoMuted &&
            !focusedParticipant.isScreenSharing
          : false,
    };
  }, [
    effectiveFocusedId,
    hostStream,
    isHost,
    screenStream,
    localStream,
    hostDisplayName,
    hostScreenSharing,
    isScreenAudioShared,
    resolvedDisplayName,
    hostAudioMuted,
    hostStreamPlaybackMuted,
    hostVideoMuted,
    roomConnection?.localParticipantId,
    videoParticipants,
    isAudioMuted,
  ]);

  return { chatParticipants, galleryParticipants, primaryViewProps };
}
