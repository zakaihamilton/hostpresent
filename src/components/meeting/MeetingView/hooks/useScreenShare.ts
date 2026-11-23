import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RoomMediaControlsConnection } from "@/hooks/roomDataChannel/types";
import {
  createParticipantScreenShareStartedMessage,
  createParticipantScreenShareStoppedMessage,
} from "@/lib/signaling/messages";
import { PUBLISHER_VIDEO_CONSTRAINTS } from "@/lib/webrtc/audienceQuality";
import { prepareOutboundAudioMix } from "@/lib/webrtc/outboundMedia";

export function useScreenShare({
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
}: {
  isHost?: boolean;
  isListeningOnly: boolean;
  roomConnection?: RoomMediaControlsConnection;
  localStream?: MediaStream | null;
  screenStream?: MediaStream | null;
  setScreenStream: Dispatch<SetStateAction<MediaStream | null>>;
  setScreenStreamRef: MutableRefObject<
    Dispatch<SetStateAction<MediaStream | null>>
  >;
  screenStreamRef: MutableRefObject<MediaStream | null>;
  syncOutboundMediaRef: MutableRefObject<
    RoomMediaControlsConnection["syncOutboundMedia"] | undefined
  >;
  keepAcquiredStream: (stream: MediaStream) => boolean;
  setErrorMsg: Dispatch<SetStateAction<string>>;
}) {
  const [shareScreenAudio, setShareScreenAudio] = useState(true);
  const activeScreenStreamRef = useRef(screenStream);
  const hadScreenStreamRef = useRef(Boolean(screenStream));

  const isScreenAudioShared = Boolean(
    screenStream?.getAudioTracks().some((track) => track.readyState === "live"),
  );

  // Wait for the screen-stream state to reach roomDataChannel before syncing.
  // Calling sync directly after setScreenStream() uses the previous stream, so
  // viewers keep receiving the camera when sharing starts (and the screen when
  // it stops).
  useEffect(() => {
    screenStreamRef.current = screenStream ?? null;
    activeScreenStreamRef.current = screenStream;
    if (!screenStream && !hadScreenStreamRef.current) return;

    hadScreenStreamRef.current = Boolean(screenStream);
    void syncOutboundMediaRef.current?.();
  }, [screenStream, screenStreamRef, syncOutboundMediaRef]);

  const publishScreenShareStatus = useCallback(
    (screenSharing: boolean) => {
      if (isHost) return;

      const participantId = roomConnection?.localParticipantId;
      if (!participantId) return;
      roomConnection.send(
        screenSharing
          ? createParticipantScreenShareStartedMessage({ participantId })
          : createParticipantScreenShareStoppedMessage({ participantId }),
      );
    },
    [isHost, roomConnection],
  );

  const stopScreenShare = useCallback(
    (streamToStop?: MediaStream | null) => {
      if (
        streamToStop &&
        activeScreenStreamRef.current &&
        activeScreenStreamRef.current !== streamToStop
      ) {
        return;
      }

      activeScreenStreamRef.current = null;
      screenStreamRef.current = null;
      setScreenStream(null);

      // Replace the outbound screen track before the state effect runs. This
      // prevents a viewer from retaining the last screen frame while React
      // propagates the cleared stream through the room connection hook.
      void roomConnection?.syncOutboundMedia?.({ screenStream: null });
      publishScreenShareStatus(false);

      if (streamToStop) {
        for (const track of streamToStop.getTracks()) {
          if (track.readyState !== "ended") track.stop();
        }
      }
    },
    [
      publishScreenShareStatus,
      roomConnection,
      screenStreamRef,
      setScreenStream,
    ],
  );

  useEffect(() => {
    if (!isListeningOnly || !screenStream) return;
    stopScreenShare(screenStream);
  }, [isListeningOnly, screenStream, stopScreenShare]);

  useEffect(() => {
    setScreenStreamRef.current = setScreenStream;
  }, [setScreenStream, setScreenStreamRef]);

  const toggleScreenShare = useCallback(async () => {
    if (isListeningOnly) return;

    if (screenStream) {
      stopScreenShare(screenStream);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: PUBLISHER_VIDEO_CONSTRAINTS,
        audio: shareScreenAudio
          ? ({
              suppressLocalAudioPlayback: false,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            } as MediaTrackConstraints)
          : false,
      });

      if (!keepAcquiredStream(stream)) return;
      const screenVideoTrack = stream.getVideoTracks()[0];
      if (!screenVideoTrack) {
        for (const track of stream.getTracks()) track.stop();
        setErrorMsg(
          "[E041] Could not start screen sharing. Check browser permissions and try again.",
        );
        return;
      }

      // Starting the mixer while the share action is still user initiated
      // avoids browsers leaving AudioContext suspended in the later state
      // synchronization effect.
      await prepareOutboundAudioMix(localStream, stream);

      if (!keepAcquiredStream(stream)) return;
      activeScreenStreamRef.current = stream;
      screenVideoTrack.onended = () => {
        stopScreenShare(stream);
      };

      setScreenStream(stream);
      publishScreenShareStatus(true);
      setErrorMsg("");

      if (shareScreenAudio && stream.getAudioTracks().length === 0) {
        setErrorMsg(
          "[E043] Screen shared without audio. Enable \u201cShare tab audio\u201d in the browser picker, or turn on Share Audio before sharing.",
        );
      }
    } catch (err) {
      console.warn("Screen sharing failed:", err);
      if (err?.name === "NotAllowedError") {
        setErrorMsg(
          "[E042] Screen sharing was cancelled or denied. Allow screen capture and try again.",
        );
      } else {
        setErrorMsg(
          "[E041] Could not start screen sharing. Check browser permissions and try again.",
        );
      }
    }
  }, [
    isListeningOnly,
    keepAcquiredStream,
    localStream,
    publishScreenShareStatus,
    screenStream,
    setErrorMsg,
    setScreenStream,
    shareScreenAudio,
    stopScreenShare,
  ]);

  const setShareScreenAudioPreference = useCallback((includeAudio: boolean) => {
    setShareScreenAudio(includeAudio);
  }, []);

  return {
    shareScreenAudio,
    isScreenAudioShared,
    toggleScreenShare,
    setShareScreenAudioPreference,
  };
}
