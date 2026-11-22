import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RoomMediaControlsConnection } from "@/hooks/roomDataChannel/types";
import { PARTICIPANT_MODE } from "@/lib/settings/displayNameSettings";
import type { ParticipantMode } from "@/lib/signaling/messages";
import {
  createHostAudioMutedMessage,
  createHostAudioUnmutedMessage,
  createHostVideoMutedMessage,
  createHostVideoUnmutedMessage,
  createParticipantAudioMutedMessage,
  createParticipantAudioUnmutedMessage,
  createParticipantVideoMutedMessage,
  createParticipantVideoUnmutedMessage,
} from "@/lib/signaling/messages";
import { PUBLISHER_VIDEO_CONSTRAINTS } from "@/lib/webrtc/audienceQuality";
import {
  audioConstraintsForDevice,
  loadVoiceIsolationPreference,
  useMediaDeviceSelection,
} from "./useMediaDeviceSelection";
import { useScreenShare } from "./useScreenShare";

export function MediaControls({
  isHost,
  participantMode = PARTICIPANT_MODE.AVAILABLE,
  publishingGranted = false,
  roomConnection,
  localStream,
  setLocalStream,
  screenStream,
  setScreenStream,
}: {
  isHost?: boolean;
  participantMode?: ParticipantMode;
  publishingGranted?: boolean;
  roomConnection?: RoomMediaControlsConnection;
  localStream?: MediaStream | null;
  setLocalStream: Dispatch<SetStateAction<MediaStream | null>>;
  screenStream?: MediaStream | null;
  setScreenStream: Dispatch<SetStateAction<MediaStream | null>>;
}) {
  const [isAudioMuted, setIsAudioMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = window.localStorage.getItem("hostpresent.audioMuted");
      return stored === "true";
    } catch {
      return false;
    }
  });
  const [isVideoMuted, setIsVideoMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = window.localStorage.getItem("hostpresent.videoMuted");
      return stored === "true";
    } catch {
      return false;
    }
  });
  const [localTrackRevision, setLocalTrackRevision] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const setScreenStreamRef = useRef(setScreenStream);
  setScreenStreamRef.current = setScreenStream;
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const initialAudioMutedRef = useRef(isAudioMuted);
  const initialVideoMutedRef = useRef(isVideoMuted);
  const initialVoiceIsolationRef = useRef(loadVoiceIsolationPreference());
  const syncOutboundMediaRef = useRef(roomConnection?.syncOutboundMedia);
  syncOutboundMediaRef.current = roomConnection?.syncOutboundMedia;
  const isListeningOnly =
    !isHost &&
    (!publishingGranted || participantMode === PARTICIPANT_MODE.LISTENING);

  const publishingAllowedRef = useRef(!isListeningOnly);
  publishingAllowedRef.current = !isListeningOnly;
  const keepAcquiredStream = useCallback((stream: MediaStream) => {
    if (publishingAllowedRef.current) return true;
    for (const track of stream.getTracks()) track.stop();
    return false;
  }, []);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const {
    availableCameras,
    selectedCamera,
    switchCamera,
    availableMicrophones,
    selectedMicrophone,
    switchMicrophone,
    isVoiceIsolationEnabled,
    isVoiceIsolationChanging,
    setVoiceIsolation,
    availableSpeakers,
    selectedSpeaker,
    switchSpeaker,
    acquireReplacementVideoTrack,
    syncEnumeratedDevices,
  } = useMediaDeviceSelection({
    localStream,
    isAudioMuted,
    isVideoMuted,
    roomConnection,
    publishingAllowedRef,
    keepAcquiredStream,
    setLocalTrackRevision,
    setErrorMsg,
  });

  const {
    shareScreenAudio,
    isScreenAudioShared,
    toggleScreenShare,
    setShareScreenAudioPreference,
  } = useScreenShare({
    isHost,
    isListeningOnly,
    roomConnection,
    localStream,
    screenStream,
    setScreenStream,
    setScreenStreamRef,
    screenStreamRef,
    syncOutboundMediaRef,
    keepAcquiredStream,
    setErrorMsg,
  });

  useEffect(() => {
    let cancelled = false;
    let acquiredStream: MediaStream | null = null;

    const initLocalMedia = async () => {
      if (isListeningOnly) {
        setLocalStream(null);
        setScreenStreamRef.current(null);
        void syncOutboundMediaRef.current?.({ localStream: null });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: PUBLISHER_VIDEO_CONSTRAINTS,
          audio: audioConstraintsForDevice(
            undefined,
            initialVoiceIsolationRef.current,
          ),
        });
        acquiredStream = stream;
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        if (!keepAcquiredStream(stream)) return;
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !initialAudioMutedRef.current;
        });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = !initialVideoMutedRef.current;
        });
        setLocalStream(stream);
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        syncEnumeratedDevices(devices, stream);
      } catch (err) {
        console.error("Failed to acquire camera/mic permissions:", err);
        setErrorMsg(
          err?.name === "NotAllowedError"
            ? "[E046] Camera or microphone access was denied. Allow permissions in your browser settings and reload."
            : "[E047] Could not access camera or microphone. Check devices and try again.",
        );
      }
    };
    initLocalMedia();

    return () => {
      cancelled = true;
      const streamToStop = localStreamRef.current ?? acquiredStream;
      if (streamToStop) {
        for (const track of streamToStop.getTracks()) {
          track.stop();
        }
      }
      if (screenStreamRef.current) {
        for (const track of screenStreamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, [
    isListeningOnly,
    keepAcquiredStream,
    setLocalStream,
    syncEnumeratedDevices,
  ]);

  // Once local media first becomes available, push tracks onto any open PeerJS calls.
  // Device switches/toggles call syncOutboundMedia explicitly.
  const hadLocalStreamRef = useRef(false);
  useEffect(() => {
    if (!localStream) {
      hadLocalStreamRef.current = false;
      return;
    }
    if (hadLocalStreamRef.current) return;
    hadLocalStreamRef.current = true;
    void syncOutboundMediaRef.current?.();
  }, [localStream]);

  const participantId = roomConnection?.localParticipantId;
  const sendStatus = roomConnection?.send;
  const publishParticipantMediaStatus = useCallback(
    ({
      audioMuted,
      videoMuted,
    }: {
      audioMuted?: boolean;
      videoMuted?: boolean;
    }) => {
      if (!participantId) return;

      if (typeof audioMuted === "boolean") {
        sendStatus?.(
          audioMuted
            ? createParticipantAudioMutedMessage({
                participantId,
                participantType: "video",
              })
            : createParticipantAudioUnmutedMessage({
                participantId,
                participantType: "video",
              }),
        );
      }

      if (typeof videoMuted === "boolean") {
        sendStatus?.(
          videoMuted
            ? createParticipantVideoMutedMessage({ participantId })
            : createParticipantVideoUnmutedMessage({ participantId }),
        );
      }
    },
    [participantId, sendStatus],
  );

  const toggleAudio = useCallback(() => {
    if (!publishingAllowedRef.current || !localStream) return;

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    const nextMuted = !localStream.getAudioTracks()[0]?.enabled;
    setIsAudioMuted(nextMuted);
    try {
      window.localStorage.setItem("hostpresent.audioMuted", String(nextMuted));
    } catch {}

    void roomConnection?.syncOutboundMedia?.();

    if (isHost) {
      roomConnection?.send(
        nextMuted
          ? createHostAudioMutedMessage()
          : createHostAudioUnmutedMessage(),
      );
      return;
    }

    publishParticipantMediaStatus({ audioMuted: nextMuted });
  }, [isHost, localStream, publishParticipantMediaStatus, roomConnection]);

  const toggleVideo = useCallback(() => {
    if (!publishingAllowedRef.current || !localStream) return;

    void (async () => {
      const currentTracks = localStream.getVideoTracks();
      const isCurrentlyMuted =
        isVideoMuted || !currentTracks.some((track) => track.enabled);
      const nextMuted = !isCurrentlyMuted;

      let nextTracks = currentTracks.filter(
        (track) => track.readyState === "live",
      );
      if (!nextMuted && nextTracks.length === 0) {
        const replacement = await acquireReplacementVideoTrack();
        nextTracks = replacement ? [replacement] : [];
      }

      for (const track of nextTracks) {
        track.enabled = !nextMuted;
      }
      setIsVideoMuted(nextMuted);
      try {
        window.localStorage.setItem(
          "hostpresent.videoMuted",
          String(nextMuted),
        );
      } catch {}

      void roomConnection?.syncOutboundMedia?.();

      if (isHost) {
        roomConnection?.send(
          nextMuted
            ? createHostVideoMutedMessage()
            : createHostVideoUnmutedMessage(),
        );
        return;
      }

      publishParticipantMediaStatus({ videoMuted: nextMuted });
    })().catch((err) => {
      console.error("Failed to toggle camera:", err);
      setErrorMsg(
        "[E045] Could not turn camera back on. Check permissions and try again.",
      );
    });
  }, [
    acquireReplacementVideoTrack,
    isHost,
    isVideoMuted,
    localStream,
    publishParticipantMediaStatus,
    roomConnection,
  ]);

  return {
    localTrackRevision,
    localStream,
    setLocalStream,
    screenStream,
    setScreenStream,
    isAudioMuted,
    setIsAudioMuted,
    isVideoMuted,
    setIsVideoMuted,
    errorMsg,
    setErrorMsg,
    shareScreenAudio,
    isScreenAudioShared,
    publishParticipantMediaStatus,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    setShareScreenAudioPreference,
    localStreamRef,
    screenStreamRef,
    availableCameras,
    selectedCamera,
    switchCamera,
    availableMicrophones,
    selectedMicrophone,
    switchMicrophone,
    isVoiceIsolationEnabled,
    isVoiceIsolationChanging,
    setVoiceIsolation,
    availableSpeakers,
    selectedSpeaker,
    switchSpeaker,
  };
}
