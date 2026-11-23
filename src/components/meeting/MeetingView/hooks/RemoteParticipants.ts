import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RoomMessageHandler } from "@/hooks/roomDataChannel/types";
import {
  PARTICIPANT_MODE,
  resolveDisplayName,
} from "@/lib/settings/displayNameSettings";
import type {
  ParticipantMode,
  SignalingMessage,
} from "@/lib/signaling/messages";
import {
  createParticipantProfileBroadcastMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import {
  attachRemoteStreamMediaListeners,
  type readRemoteStreamMediaState,
} from "@/lib/webrtc/remoteParticipantMedia";
import { attachSpeakingDetector } from "@/lib/webrtc/speakingDetector";
import { useAttendeeSignalingCommands } from "./useAttendeeSignalingCommands";
import { useRemoteHostState } from "./useRemoteHostState";

export interface RemoteParticipantsConnection {
  localParticipantId?: string;
  hostPresent?: boolean;
  send: (message: SignalingMessage) => boolean;
  sendToParticipant: (
    participantId: string,
    message: SignalingMessage,
  ) => boolean;
  subscribe: (handler: RoomMessageHandler) => () => void;
  disconnect: () => void;
  syncOutboundMedia?: (streams?: {
    localStream?: MediaStream | null;
    screenStream?: MediaStream | null;
  }) => Promise<void>;
}

export interface ParticipantMediaState {
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
}

export interface VideoParticipant extends ParticipantMediaState {
  id: string;
  name: string;
  avatarColor: string;
  stream: MediaStream | null;
  mode: ParticipantMode;
  isSpeaking?: boolean;
}

export interface PeerParticipant extends Omit<VideoParticipant, "stream"> {}

interface AudioParticipant {
  id: string;
  name: string;
  isMuted: boolean;
  isSpeaking?: boolean;
}

export interface RemoteParticipantSignalingProps {
  isHost: boolean;
  roomConnectionRef: MutableRefObject<RemoteParticipantsConnection | null>;
  roomConnection: RemoteParticipantsConnection;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  setIsAudioMuted: Dispatch<SetStateAction<boolean>>;
  setIsVideoMuted: Dispatch<SetStateAction<boolean>>;
  setIsRecording: Dispatch<SetStateAction<boolean>>;
  setIsRecordingPaused: Dispatch<SetStateAction<boolean>>;
  resetRecordingTimer: () => void;
  publishParticipantMediaStatus: (state: {
    audioMuted?: boolean;
    videoMuted?: boolean;
  }) => void;
}

interface RemoteParticipantsProps extends RemoteParticipantSignalingProps {
  setSessionTitle: Dispatch<SetStateAction<string>>;
}

function participantColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360} 55% 45%)`;
}

export function useRemoteParticipants({
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
  setSessionTitle,
}: RemoteParticipantsProps) {
  const [videoParticipants, setVideoParticipants] = useState<
    VideoParticipant[]
  >([]);
  const [peerParticipants, setPeerParticipants] = useState<PeerParticipant[]>(
    [],
  );
  const [audioList, setAudioList] = useState<AudioParticipant[]>([]);

  const participantProfilesRef = useRef(
    new Map<string, { displayName?: string; mode?: ParticipantMode }>(),
  );
  const peerMediaStateRef = useRef(
    new Map<string, Partial<ParticipantMediaState>>(),
  );
  const streamListenerCleanupsRef = useRef(new Map<string, () => void>());
  const speakingCleanupsRef = useRef(new Map<string, () => void>());

  const {
    hostStream,
    hostStreamPlaybackMuted,
    hostDisplayName,
    hostAudioMuted,
    hostVideoMuted,
    hostScreenSharing,
    hostMode,
    hostPresent,
    hostIsSpeaking,
    handleRemoteHostStream,
  } = useRemoteHostState({
    isHost,
    roomConnection,
    roomConnectionRef,
    setSessionTitle,
  });

  const broadcastPeerProfile = useCallback(
    ({
      participantId,
      displayName,
      mode,
    }: {
      participantId?: string;
      displayName?: string;
      mode?: ParticipantMode;
    }) => {
      if (!isHost) return;
      const participant = videoParticipants.find(
        (entry) => entry.id === participantId,
      );
      roomConnectionRef.current?.send(
        createParticipantProfileBroadcastMessage({
          participantId,
          displayName,
          mode,
          present: true,
          screenSharing: participant?.isScreenSharing ?? false,
          isAudioMuted: participant?.isAudioMuted ?? false,
          isVideoMuted: participant?.isVideoMuted ?? false,
        }),
      );
    },
    [isHost, roomConnectionRef, videoParticipants],
  );

  const broadcastPeerLeft = useCallback(
    (participantId: string) => {
      if (!isHost) return;
      participantProfilesRef.current.delete(participantId);
      roomConnectionRef.current?.send(
        createParticipantProfileBroadcastMessage({
          participantId,
          present: false,
        }),
      );
    },
    [isHost, roomConnectionRef],
  );

  const syncProfilesToParticipant = useCallback(
    (participantId: string) => {
      if (!isHost) return;
      for (const [id, profile] of participantProfilesRef.current) {
        if (id === participantId) continue;
        const participant = videoParticipants.find((entry) => entry.id === id);
        roomConnectionRef.current?.sendToParticipant(
          participantId,
          createParticipantProfileBroadcastMessage({
            participantId: id,
            displayName: profile.displayName,
            mode: profile.mode,
            screenSharing: participant?.isScreenSharing ?? false,
            isAudioMuted: participant?.isAudioMuted ?? false,
            isVideoMuted: participant?.isVideoMuted ?? false,
            present: true,
          }),
        );
      }
    },
    [isHost, roomConnectionRef, videoParticipants],
  );

  const applyRemoteStreamMediaState = useCallback(
    (
      participantId: string,
      mediaState: ReturnType<typeof readRemoteStreamMediaState>,
    ) => {
      setVideoParticipants((previous) =>
        previous.map((entry) => {
          if (entry.id !== participantId) return entry;
          return {
            ...entry,
            ...(mediaState.isAudioMuted !== null
              ? { isAudioMuted: mediaState.isAudioMuted }
              : {}),
            ...(mediaState.isVideoMuted !== null
              ? { isVideoMuted: mediaState.isVideoMuted }
              : {}),
          };
        }),
      );
    },
    [],
  );

  const bindRemoteStreamMediaListeners = useCallback(
    (participantId: string, stream: MediaStream | null | undefined) => {
      const cleanups = streamListenerCleanupsRef.current;
      cleanups.get(participantId)?.();
      cleanups.delete(participantId);

      if (!stream) return;

      cleanups.set(
        participantId,
        attachRemoteStreamMediaListeners(stream, (mediaState) => {
          applyRemoteStreamMediaState(participantId, mediaState);
        }),
      );
    },
    [applyRemoteStreamMediaState],
  );

  const handleRemoteParticipant = useCallback(
    (participant: {
      id: string;
      name?: string;
      stream?: MediaStream | null;
      mode?: ParticipantMode;
      preserveProfile?: boolean;
    }) => {
      if (!participant?.id) return;

      if (participant.stream === null) {
        streamListenerCleanupsRef.current.get(participant.id)?.();
        streamListenerCleanupsRef.current.delete(participant.id);
        speakingCleanupsRef.current.get(participant.id)?.();
        speakingCleanupsRef.current.delete(participant.id);
        if (participant.preserveProfile) {
          setVideoParticipants((previous) =>
            previous.map((entry) =>
              entry.id === participant.id
                ? { ...entry, stream: null, isSpeaking: false }
                : entry,
            ),
          );
        } else {
          setVideoParticipants((previous) =>
            previous.filter((entry) => entry.id !== participant.id),
          );
          broadcastPeerLeft(participant.id);
        }
        return;
      }

      const isNewConnection = participant.stream === undefined;
      const nextMode =
        participant.mode === PARTICIPANT_MODE.LISTENING
          ? PARTICIPANT_MODE.LISTENING
          : participant.mode === PARTICIPANT_MODE.AVAILABLE
            ? PARTICIPANT_MODE.AVAILABLE
            : undefined;

      setVideoParticipants((previous) => {
        const existing = previous.find((entry) => entry.id === participant.id);
        const nextName =
          participant.name !== undefined
            ? resolveDisplayName(participant.name)
            : undefined;
        if (existing) {
          return previous.map((entry) =>
            entry.id === participant.id
              ? {
                  ...entry,
                  ...(participant.stream !== undefined
                    ? { stream: participant.stream }
                    : {}),
                  ...(nextName ? { name: nextName } : {}),
                  ...(nextMode ? { mode: nextMode } : {}),
                }
              : entry,
          );
        }
        return [
          ...previous,
          {
            id: participant.id,
            name: nextName ?? "Guest",
            avatarColor: participantColor(participant.id),
            isAudioMuted:
              peerMediaStateRef.current.get(participant.id)?.isAudioMuted ??
              false,
            isVideoMuted:
              peerMediaStateRef.current.get(participant.id)?.isVideoMuted ??
              false,
            isScreenSharing:
              peerMediaStateRef.current.get(participant.id)?.isScreenSharing ??
              false,
            stream: participant.stream ?? null,
            mode: nextMode ?? PARTICIPANT_MODE.AVAILABLE,
          },
        ];
      });

      if (participant.stream) {
        bindRemoteStreamMediaListeners(participant.id, participant.stream);
        speakingCleanupsRef.current.get(participant.id)?.();
        speakingCleanupsRef.current.set(
          participant.id,
          attachSpeakingDetector(participant.stream, (isSpeaking) => {
            setVideoParticipants((previous) =>
              previous.map((entry) =>
                entry.id === participant.id ? { ...entry, isSpeaking } : entry,
              ),
            );
          }),
        );
      }

      if (isNewConnection) {
        syncProfilesToParticipant(participant.id);
      }
    },
    [
      bindRemoteStreamMediaListeners,
      broadcastPeerLeft,
      syncProfilesToParticipant,
    ],
  );

  const handlePeerProfileBroadcast = useCallback(
    (message: SignalingMessage) => {
      if (!message?.participantId) return;
      const participantId = message.participantId;

      if (message.present === false) {
        peerMediaStateRef.current.delete(participantId);
        streamListenerCleanupsRef.current.get(participantId)?.();
        streamListenerCleanupsRef.current.delete(participantId);
        speakingCleanupsRef.current.get(participantId)?.();
        speakingCleanupsRef.current.delete(participantId);
        setPeerParticipants((previous) =>
          previous.filter((entry) => entry.id !== participantId),
        );
        setVideoParticipants((previous) =>
          previous.filter((entry) => entry.id !== participantId),
        );
        return;
      }

      const previousMediaState =
        peerMediaStateRef.current.get(participantId) ?? {};
      const nextMediaState = {
        isScreenSharing:
          typeof message.screenSharing === "boolean"
            ? message.screenSharing
            : (previousMediaState.isScreenSharing ?? false),
        isAudioMuted:
          typeof message.isAudioMuted === "boolean"
            ? message.isAudioMuted
            : (previousMediaState.isAudioMuted ?? false),
        isVideoMuted:
          typeof message.isVideoMuted === "boolean"
            ? message.isVideoMuted
            : (previousMediaState.isVideoMuted ?? false),
      };
      peerMediaStateRef.current.set(participantId, nextMediaState);

      const nextName = resolveDisplayName(message.displayName);
      const nextMode =
        message.mode === PARTICIPANT_MODE.LISTENING
          ? PARTICIPANT_MODE.LISTENING
          : PARTICIPANT_MODE.AVAILABLE;

      setPeerParticipants((previous) => {
        const existing = previous.find((entry) => entry.id === participantId);
        if (existing) {
          return previous.map((entry) =>
            entry.id === participantId
              ? { ...entry, name: nextName, mode: nextMode, ...nextMediaState }
              : entry,
          );
        }
        return [
          ...previous,
          {
            id: participantId,
            name: nextName,
            mode: nextMode,
            ...nextMediaState,
            isSpeaking: false,
            avatarColor: participantColor(participantId),
          },
        ];
      });

      setVideoParticipants((previous) =>
        previous.map((entry) =>
          entry.id === participantId
            ? {
                ...entry,
                name: nextName,
                mode: nextMode,
                ...nextMediaState,
              }
            : entry,
        ),
      );
    },
    [],
  );

  const setParticipantScreenSharing = useCallback(
    (participantId: string | undefined, isScreenSharing: boolean) => {
      if (!participantId) return;
      const mediaState = peerMediaStateRef.current.get(participantId) ?? {};
      peerMediaStateRef.current.set(participantId, {
        ...mediaState,
        isScreenSharing,
      });
      setVideoParticipants((previous) =>
        previous.map((entry) =>
          entry.id === participantId ? { ...entry, isScreenSharing } : entry,
        ),
      );
      setPeerParticipants((previous) =>
        previous.map((entry) =>
          entry.id === participantId ? { ...entry, isScreenSharing } : entry,
        ),
      );
    },
    [],
  );

  useEffect(
    () => () => {
      for (const cleanup of speakingCleanupsRef.current.values()) {
        cleanup?.();
      }
      speakingCleanupsRef.current.clear();
    },
    [],
  );

  useAttendeeSignalingCommands({
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
  });

  useEffect(() => {
    if (!isHost) return undefined;

    return roomConnectionRef.current?.subscribe((message) => {
      if (message.type !== SIGNALING_MESSAGE.PARTICIPANT_PROFILE) return;

      participantProfilesRef.current.set(message.participantId, {
        displayName: message.displayName,
        mode: message.mode,
      });

      handleRemoteParticipant({
        id: message.participantId,
        name: resolveDisplayName(message.displayName),
        mode: message.mode,
      });

      broadcastPeerProfile({
        participantId: message.participantId,
        displayName: message.displayName,
        mode: message.mode,
      });
    });
  }, [
    broadcastPeerProfile,
    handleRemoteParticipant,
    isHost,
    roomConnectionRef,
  ]);

  useEffect(() => {
    if (!isHost) return undefined;

    return roomConnectionRef.current?.subscribe((message) => {
      switch (message.type) {
        case SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STARTED:
          setParticipantScreenSharing(message.participantId, true);
          break;
        case SIGNALING_MESSAGE.PARTICIPANT_SCREEN_SHARE_STOPPED:
          setParticipantScreenSharing(message.participantId, false);
          break;
        default:
          break;
      }
    });
  }, [isHost, roomConnectionRef, setParticipantScreenSharing]);

  return {
    hostStream,
    hostStreamPlaybackMuted,
    videoParticipants,
    setVideoParticipants,
    peerParticipants,
    hostDisplayName,
    hostAudioMuted,
    hostVideoMuted,
    hostScreenSharing,
    hostIsSpeaking,
    hostMode,
    hostPresent,
    audioList,
    setAudioList,
    streamListenerCleanupsRef,
    handleRemoteParticipant,
    handleRemoteHostStream,
  };
}
