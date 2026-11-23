import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
} from "react";
import {
  SIGNALING_MESSAGE,
  type SignalingMessage,
} from "@/lib/signaling/messages";
import type {
  ParticipantMediaState,
  PeerParticipant,
  RemoteParticipantSignalingProps,
  RemoteParticipantsConnection,
  VideoParticipant,
} from "./RemoteParticipants";

function disableLocalTracks(
  kind: "audio" | "video",
  {
    localStream,
    screenStream,
    setMuted,
    publishParticipantMediaStatus,
    roomConnection,
  }: {
    localStream: MediaStream | null;
    screenStream: MediaStream | null;
    setMuted: Dispatch<SetStateAction<boolean>>;
    publishParticipantMediaStatus: (state: {
      audioMuted?: boolean;
      videoMuted?: boolean;
    }) => void;
    roomConnection: RemoteParticipantsConnection;
  },
) {
  const getTracks =
    kind === "audio"
      ? (stream: MediaStream) => stream.getAudioTracks()
      : (stream: MediaStream) => stream.getVideoTracks();
  localStream &&
    getTracks(localStream).forEach((track) => {
      track.enabled = false;
    });
  screenStream &&
    getTracks(screenStream).forEach((track) => {
      track.enabled = false;
    });
  setMuted(true);
  publishParticipantMediaStatus(
    kind === "audio" ? { audioMuted: true } : { videoMuted: true },
  );
  void roomConnection?.syncOutboundMedia?.();
}

export function useAttendeeSignalingCommands({
  isHost,
  roomConnectionRef,
  roomConnection,
  localStream,
  screenStream,
  isAudioMuted,
  isVideoMuted,
  setIsAudioMuted,
  setIsVideoMuted,
  setIsRecording,
  setIsRecordingPaused,
  resetRecordingTimer,
  publishParticipantMediaStatus,
  peerMediaStateRef,
  videoParticipants,
  setVideoParticipants,
  setPeerParticipants,
  handlePeerProfileBroadcast,
  setParticipantScreenSharing,
}: RemoteParticipantSignalingProps & {
  peerMediaStateRef: MutableRefObject<
    Map<string, Partial<ParticipantMediaState>>
  >;
  videoParticipants: VideoParticipant[];
  setVideoParticipants: Dispatch<SetStateAction<VideoParticipant[]>>;
  setPeerParticipants: Dispatch<SetStateAction<PeerParticipant[]>>;
  handlePeerProfileBroadcast: (message: SignalingMessage) => void;
  setParticipantScreenSharing: (
    participantId: string | undefined,
    isScreenSharing: boolean,
  ) => void;
}) {
  useEffect(() => {
    if (isHost) return undefined;

    return roomConnectionRef.current?.subscribe((message) => {
      const localId = roomConnectionRef.current?.localParticipantId;

      switch (message.type) {
        case SIGNALING_MESSAGE.RECORDING_STATE: {
          const active = Boolean(message.active);
          const paused = Boolean(message.paused);
          setIsRecording((previous) => {
            if (!active) {
              resetRecordingTimer();
              return false;
            }
            if (!previous && !paused) {
              resetRecordingTimer();
            }
            return true;
          });
          setIsRecordingPaused(active && paused);
          break;
        }
        case SIGNALING_MESSAGE.HOST_MUTE_AUDIO:
          if (message.participantId && message.participantId !== localId)
            return;
          disableLocalTracks("audio", {
            localStream,
            screenStream,
            setMuted: setIsAudioMuted,
            publishParticipantMediaStatus,
            roomConnection,
          });
          break;
        case SIGNALING_MESSAGE.HOST_MUTE_VIDEO:
          if (message.participantId && message.participantId !== localId)
            return;
          disableLocalTracks("video", {
            localStream,
            screenStream,
            setMuted: setIsVideoMuted,
            publishParticipantMediaStatus,
            roomConnection,
          });
          break;
        case SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO:
          disableLocalTracks("audio", {
            localStream,
            screenStream,
            setMuted: setIsAudioMuted,
            publishParticipantMediaStatus,
            roomConnection,
          });
          break;
        case SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO:
          disableLocalTracks("video", {
            localStream,
            screenStream,
            setMuted: setIsVideoMuted,
            publishParticipantMediaStatus,
            roomConnection,
          });
          break;
        case SIGNALING_MESSAGE.PARTICIPANT_PROFILE_BROADCAST:
          if (message.participantId === localId) return;
          handlePeerProfileBroadcast(message);
          break;
        case SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STARTED:
          if (message.participantId === localId) return;
          setParticipantScreenSharing(message.participantId, true);
          break;
        case SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STOPPED:
          if (message.participantId === localId) return;
          setParticipantScreenSharing(message.participantId, false);
          break;
        case SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED:
        case SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED:
        case SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED:
        case SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED: {
          if (message.participantId === localId) return;
          const peerAudioMuted =
            message.type === SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED;
          const peerVideoMuted =
            message.type === SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED;
          const audioChanged =
            message.type === SIGNALING_MESSAGE.PARTICIPANT_AUDIO_MUTED ||
            message.type === SIGNALING_MESSAGE.PARTICIPANT_AUDIO_UNMUTED;
          const videoChanged =
            message.type === SIGNALING_MESSAGE.PARTICIPANT_VIDEO_MUTED ||
            message.type === SIGNALING_MESSAGE.PARTICIPANT_VIDEO_UNMUTED;
          const previousMediaState =
            peerMediaStateRef.current.get(message.participantId) ?? {};
          const nextMediaState = {
            ...previousMediaState,
            ...(audioChanged ? { isAudioMuted: peerAudioMuted } : {}),
            ...(videoChanged ? { isVideoMuted: peerVideoMuted } : {}),
          };
          peerMediaStateRef.current.set(message.participantId, nextMediaState);
          setPeerParticipants((prev) =>
            prev.map((entry) => {
              if (entry.id !== message.participantId) return entry;
              const updated = { ...entry };
              if (audioChanged) updated.isAudioMuted = peerAudioMuted;
              if (videoChanged) updated.isVideoMuted = peerVideoMuted;
              return updated;
            }),
          );
          setVideoParticipants((previous) =>
            previous.map((entry) =>
              entry.id === message.participantId
                ? {
                    ...entry,
                    ...(audioChanged ? { isAudioMuted: peerAudioMuted } : {}),
                    ...(videoChanged ? { isVideoMuted: peerVideoMuted } : {}),
                  }
                : entry,
            ),
          );
          break;
        }
        default:
          break;
      }
    });
  }, [
    handlePeerProfileBroadcast,
    isHost,
    localStream,
    peerMediaStateRef,
    publishParticipantMediaStatus,
    resetRecordingTimer,
    roomConnection,
    roomConnectionRef,
    screenStream,
    setIsAudioMuted,
    setIsRecording,
    setIsRecordingPaused,
    setIsVideoMuted,
    setParticipantScreenSharing,
    setPeerParticipants,
    setVideoParticipants,
  ]);

  useEffect(() => {
    if (isHost || !roomConnection?.localParticipantId) return undefined;

    publishParticipantMediaStatus({
      audioMuted: isAudioMuted,
      videoMuted: isVideoMuted,
    });

    return undefined;
  }, [
    isAudioMuted,
    isHost,
    isVideoMuted,
    publishParticipantMediaStatus,
    roomConnection?.localParticipantId,
  ]);

  useEffect(() => {
    if (isHost) return;
    setPeerParticipants((previous) => {
      let changed = false;
      const next = previous.map((peer) => {
        const videoEntry = videoParticipants.find(
          (entry) => entry.id === peer.id,
        );
        if (videoEntry && videoEntry.isSpeaking !== peer.isSpeaking) {
          changed = true;
          return { ...peer, isSpeaking: videoEntry.isSpeaking };
        }
        return peer;
      });
      return changed ? next : previous;
    });
  }, [isHost, setPeerParticipants, videoParticipants]);
}
