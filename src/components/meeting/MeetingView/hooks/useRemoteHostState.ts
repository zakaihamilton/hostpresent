import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { resolveDisplayName } from "@/lib/settings/displayNameSettings";
import {
  type ParticipantMode,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import {
  attachRemoteStreamMediaListeners,
  hasPlayableRemoteAudio,
} from "@/lib/webrtc/remoteParticipantMedia";
import { attachSpeakingDetector } from "@/lib/webrtc/speakingDetector";
import type { RemoteParticipantsConnection } from "./RemoteParticipants";

export function useRemoteHostState({
  isHost,
  roomConnection,
  roomConnectionRef,
  setSessionTitle,
}: {
  isHost: boolean;
  roomConnection: RemoteParticipantsConnection;
  roomConnectionRef: MutableRefObject<RemoteParticipantsConnection | null>;
  setSessionTitle: Dispatch<SetStateAction<string>>;
}) {
  const [hostStream, setHostStream] = useState<MediaStream | null>(null);
  const [hostStreamPlaybackMuted, setHostStreamPlaybackMuted] = useState(true);
  const [hostDisplayName, setHostDisplayName] = useState("Host");
  const [hostAudioMuted, setHostAudioMuted] = useState(false);
  const [hostVideoMuted, setHostVideoMuted] = useState(false);
  const [hostScreenSharing, setHostScreenSharing] = useState(false);
  const [hostMode, setHostMode] = useState<ParticipantMode>("available");
  const [hostPresent, setHostPresent] = useState(isHost);
  const [hostIsSpeaking, setHostIsSpeaking] = useState(false);
  const hostSpeakingCleanupRef = useRef<(() => void) | null>(null);

  const handleRemoteHostStream = useCallback((stream: MediaStream | null) => {
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
      if (typeof message.screenSharing === "boolean") {
        setHostScreenSharing(message.screenSharing);
      }
      if (message.mode === "listening" || message.mode === "available") {
        setHostMode(message.mode);
      }
      if (typeof message.sessionTitle === "string" && setSessionTitle) {
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

  return {
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
  };
}
