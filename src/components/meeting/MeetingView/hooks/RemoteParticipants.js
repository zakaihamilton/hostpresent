import { useCallback, useEffect, useRef, useState } from "react";
import {
  PARTICIPANT_MODE,
  resolveDisplayName,
} from "@/lib/settings/displayNameSettings";
import {
  createParticipantProfileBroadcastMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import {
  attachRemoteStreamMediaListeners,
  hasPlayableRemoteAudio,
} from "@/lib/webrtc/remoteParticipantMedia";

function participantColor(id) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360} 55% 45%)`;
}

const SPEAKING_SAMPLE_MS = 140;
const SPEAKING_THRESHOLD = 0.055;

function attachSpeakingDetector(stream, onSpeakingChange) {
  if (
    typeof window === "undefined" ||
    !stream?.getAudioTracks?.().some((track) => track.readyState === "live") ||
    typeof onSpeakingChange !== "function"
  ) {
    return () => {};
  }

  const AudioContextConstructor =
    window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return () => {};

  let context;
  let source;
  let intervalId;
  let lastSpeaking = false;

  try {
    context = new AudioContextConstructor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);

    intervalId = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const value of samples) {
        const normalized = (value - 128) / 128;
        sum += normalized * normalized;
      }
      const speaking = Math.sqrt(sum / samples.length) >= SPEAKING_THRESHOLD;
      if (speaking !== lastSpeaking) {
        lastSpeaking = speaking;
        onSpeakingChange(speaking);
      }
    }, SPEAKING_SAMPLE_MS);
  } catch {
    return () => {};
  }

  return () => {
    if (intervalId) window.clearInterval(intervalId);
    if (lastSpeaking) onSpeakingChange(false);
    try {
      source?.disconnect();
    } catch {}
    void context?.close?.();
  };
}

export function RemoteParticipants({
  isHost,
  roomConnectionRef,
  roomConnection,
  localStream,
  isAudioMuted,
  isVideoMuted,
  setIsAudioMuted,
  setIsVideoMuted,
  setIsRecording,
  setIsRecordingPaused,
  resetRecordingTimer,
  publishParticipantMediaStatus,
  isRecording,
  isRecordingPaused,
  setSessionTitle,
}) {
  const [hostStream, setHostStream] = useState(null);
  const [hostStreamPlaybackMuted, setHostStreamPlaybackMuted] = useState(true);
  const [videoParticipants, setVideoParticipants] = useState([]);
  const [peerParticipants, setPeerParticipants] = useState([]);
  const [hostDisplayName, setHostDisplayName] = useState("Host");
  const [hostAudioMuted, setHostAudioMuted] = useState(false);
  const [hostVideoMuted, setHostVideoMuted] = useState(false);
  const [hostMode, setHostMode] = useState("available");
  const [hostPresent, setHostPresent] = useState(isHost);
  const [hostIsSpeaking, setHostIsSpeaking] = useState(false);
  const [audioList, setAudioList] = useState([]);

  const participantProfilesRef = useRef(new Map());
  const streamListenerCleanupsRef = useRef(new Map());
  const speakingCleanupsRef = useRef(new Map());
  const hostSpeakingCleanupRef = useRef(null);

  const handleRemoteHostStream = useCallback((stream) => {
    hostSpeakingCleanupRef.current?.();
    hostSpeakingCleanupRef.current = null;
    setHostStream(stream);
    setHostStreamPlaybackMuted(!hasPlayableRemoteAudio(stream));
    if (stream) {
      hostSpeakingCleanupRef.current = attachSpeakingDetector(
        stream,
        setHostIsSpeaking,
      );
    } else {
      setHostIsSpeaking(false);
    }
  }, []);

  useEffect(() => {
    if (isHost) return undefined;
    if (!hostStream) {
      setHostStreamPlaybackMuted(true);
      return undefined;
    }

    return attachRemoteStreamMediaListeners(hostStream, () => {
      setHostStreamPlaybackMuted(!hasPlayableRemoteAudio(hostStream));
    });
  }, [hostStream, isHost]);

  const broadcastPeerProfile = useCallback(
    ({ participantId, displayName, mode }) => {
      if (!isHost) return;
      roomConnectionRef.current?.send(
        createParticipantProfileBroadcastMessage({
          participantId,
          displayName,
          mode,
          present: true,
        }),
      );
    },
    [isHost, roomConnectionRef],
  );

  const broadcastPeerLeft = useCallback(
    (participantId) => {
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
    (participantId) => {
      if (!isHost) return;
      for (const [id, profile] of participantProfilesRef.current) {
        if (id === participantId) continue;
        roomConnectionRef.current?.sendToParticipant(
          participantId,
          createParticipantProfileBroadcastMessage({
            participantId: id,
            displayName: profile.displayName,
            mode: profile.mode,
            present: true,
          }),
        );
      }
    },
    [isHost, roomConnectionRef],
  );

  const applyRemoteStreamMediaState = useCallback(
    (participantId, mediaState) => {
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
    (participantId, stream) => {
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
    (participant) => {
      if (!participant?.id) return;

      if (participant.stream === null) {
        streamListenerCleanupsRef.current.get(participant.id)?.();
        streamListenerCleanupsRef.current.delete(participant.id);
        speakingCleanupsRef.current.get(participant.id)?.();
        speakingCleanupsRef.current.delete(participant.id);
        setVideoParticipants((previous) =>
          previous.filter((entry) => entry.id !== participant.id),
        );
        broadcastPeerLeft(participant.id);
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
            isAudioMuted: false,
            isVideoMuted: false,
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

  const handlePeerProfileBroadcast = useCallback((message) => {
    if (!message?.participantId) return;

    if (message.present === false) {
      setPeerParticipants((previous) =>
        previous.filter((entry) => entry.id !== message.participantId),
      );
      return;
    }

    const nextName = resolveDisplayName(message.displayName);
    const nextMode =
      message.mode === PARTICIPANT_MODE.LISTENING
        ? PARTICIPANT_MODE.LISTENING
        : PARTICIPANT_MODE.AVAILABLE;

    setPeerParticipants((previous) => {
      const existing = previous.find(
        (entry) => entry.id === message.participantId,
      );
      if (existing) {
        return previous.map((entry) =>
          entry.id === message.participantId
            ? { ...entry, name: nextName, mode: nextMode }
            : entry,
        );
      }
      return [
        ...previous,
        {
          id: message.participantId,
          name: nextName,
          mode: nextMode,
          avatarColor: participantColor(message.participantId),
        },
      ];
    });

    setVideoParticipants((previous) =>
      previous.map((entry) =>
        entry.id === message.participantId
          ? { ...entry, name: nextName, mode: nextMode }
          : entry,
      ),
    );
  }, []);

  useEffect(() => {
    if (isHost) {
      setHostPresent(true);
      return;
    }
    setHostPresent(roomConnection?.hostPresent);
  }, [isHost, roomConnection?.hostPresent]);

  useEffect(
    () => () => {
      hostSpeakingCleanupRef.current?.();
      for (const cleanup of speakingCleanupsRef.current.values()) {
        cleanup?.();
      }
      speakingCleanupsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (isHost) return undefined;

    return roomConnectionRef.current?.subscribe((message) => {
      if (message.type !== SIGNALING_MESSAGE.HOST_PRESENT) return;

      if (message.displayName) {
        setHostDisplayName(resolveDisplayName(message.displayName));
      }
      if (typeof message.audioMuted === "boolean") {
        setHostAudioMuted(message.audioMuted);
      }
      if (typeof message.videoMuted === "boolean") {
        setHostVideoMuted(message.videoMuted);
      }
      if (message.mode === "listening" || message.mode === "available") {
        setHostMode(message.mode);
      }
      if (message.sessionTitle && setSessionTitle) {
        setSessionTitle(message.sessionTitle);
      }
    });
  }, [isHost, roomConnectionRef, setSessionTitle]);

  useEffect(() => {
    if (isHost) return undefined;

    return roomConnectionRef.current?.subscribe((message) => {
      switch (message.type) {
        case SIGNALING_MESSAGE.HOST_AUDIO_MUTED:
          setHostAudioMuted(true);
          break;
        case SIGNALING_MESSAGE.HOST_AUDIO_UNMUTED:
          setHostAudioMuted(false);
          break;
        case SIGNALING_MESSAGE.HOST_VIDEO_MUTED:
          setHostVideoMuted(true);
          break;
        case SIGNALING_MESSAGE.HOST_VIDEO_UNMUTED:
          setHostVideoMuted(false);
          break;
        default:
          break;
      }
    });
  }, [isHost, roomConnectionRef]);

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
          localStream?.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsAudioMuted(true);
          publishParticipantMediaStatus({ audioMuted: true });
          break;
        case SIGNALING_MESSAGE.HOST_MUTE_VIDEO:
          if (message.participantId && message.participantId !== localId)
            return;
          localStream?.getVideoTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsVideoMuted(true);
          publishParticipantMediaStatus({ videoMuted: true });
          break;
        case SIGNALING_MESSAGE.HOST_MUTE_ALL_AUDIO:
          localStream?.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsAudioMuted(true);
          publishParticipantMediaStatus({ audioMuted: true });
          break;
        case SIGNALING_MESSAGE.HOST_MUTE_ALL_VIDEO:
          localStream?.getVideoTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsVideoMuted(true);
          publishParticipantMediaStatus({ videoMuted: true });
          break;
        case SIGNALING_MESSAGE.PARTICIPANT_PROFILE_BROADCAST:
          if (message.participantId === localId) return;
          handlePeerProfileBroadcast(message);
          break;
        default:
          break;
      }
    });
  }, [
    handlePeerProfileBroadcast,
    isHost,
    localStream,
    publishParticipantMediaStatus,
    resetRecordingTimer,
    roomConnectionRef,
    setIsAudioMuted,
    setIsVideoMuted,
    setIsRecording,
    setIsRecordingPaused,
  ]);

  useEffect(() => {
    if (isHost || !roomConnectionRef.current?.localParticipantId)
      return undefined;

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
    roomConnectionRef.current?.localParticipantId,
  ]);

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

  return {
    hostStream,
    hostStreamPlaybackMuted,
    videoParticipants,
    setVideoParticipants,
    peerParticipants,
    hostDisplayName,
    hostAudioMuted,
    hostVideoMuted,
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
