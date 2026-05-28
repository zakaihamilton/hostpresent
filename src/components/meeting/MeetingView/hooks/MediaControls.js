import { useCallback, useEffect, useRef, useState } from "react";
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

export function MediaControls({
  isHost,
  roomConnection,
  streamListenerCleanupsRef,
  localStream,
  setLocalStream,
  screenStream,
  setScreenStream,
}) {
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [shareScreenAudio, setShareScreenAudio] = useState(true);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");

  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  const isScreenAudioShared = Boolean(
    screenStream?.getAudioTracks().some((track) => track.readyState === "live"),
  );

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableCameras(devices.filter((d) => d.kind === "videoinput"));
    } catch {
      // ignore enumeration errors
    }
  }, []);

  useEffect(() => {
    navigator.mediaDevices.addEventListener("devicechange", enumerateCameras);
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        enumerateCameras,
      );
    };
  }, [enumerateCameras]);

  useEffect(() => {
    const initLocalMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setAvailableCameras(videoInputs);
        if (videoInputs.length > 0) {
          const currentId = stream.getVideoTracks()[0]?.getSettings().deviceId;
          setSelectedCamera(currentId || videoInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Failed to acquire camera/mic permissions:", err);
      }
    };
    initLocalMedia();

    return () => {
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
      }
      if (screenStreamRef.current) {
        for (const track of screenStreamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, []);

  const switchCamera = useCallback(
    async (deviceId) => {
      if (!localStream || !deviceId || !navigator.mediaDevices) return;

      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack?.getSettings().deviceId === deviceId) return;

      const wasMuted = isVideoMuted;

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: false,
        });

        const newTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
          localStream.removeTrack(videoTrack);
          videoTrack.stop();
        }
        localStream.addTrack(newTrack);
        newTrack.enabled = !wasMuted;
        setSelectedCamera(deviceId);
      } catch (err) {
        console.error("Failed to switch camera:", err);
        setErrorMsg(
          "[E040] Could not switch camera. Check permissions and try again.",
        );
      }
    },
    [localStream, isVideoMuted, setErrorMsg],
  );

  const publishParticipantMediaStatus = useCallback(
    ({ audioMuted, videoMuted }) => {
      const participantId = roomConnection?.localParticipantId;
      if (!participantId) return;

      if (typeof audioMuted === "boolean") {
        roomConnection.send(
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
        roomConnection.send(
          videoMuted
            ? createParticipantVideoMutedMessage({ participantId })
            : createParticipantVideoUnmutedMessage({ participantId }),
        );
      }
    },
    [roomConnection],
  );

  const toggleAudio = useCallback(() => {
    if (!localStream) return;

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    const nextMuted = !localStream.getAudioTracks()[0]?.enabled;
    setIsAudioMuted(nextMuted);

    if (isHost) {
      roomConnection.send(
        nextMuted
          ? createHostAudioMutedMessage()
          : createHostAudioUnmutedMessage(),
      );
      return;
    }

    publishParticipantMediaStatus({ audioMuted: nextMuted });
  }, [isHost, localStream, publishParticipantMediaStatus, roomConnection]);

  const toggleVideo = useCallback(() => {
    if (!localStream) return;

    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    const nextMuted = !localStream.getVideoTracks()[0]?.enabled;
    setIsVideoMuted(nextMuted);

    if (isHost) {
      roomConnection.send(
        nextMuted
          ? createHostVideoMutedMessage()
          : createHostVideoUnmutedMessage(),
      );
      return;
    }

    publishParticipantMediaStatus({ videoMuted: nextMuted });
  }, [isHost, localStream, publishParticipantMediaStatus, roomConnection]);

  const toggleScreenShare = useCallback(async () => {
    if (screenStream) {
      for (const track of screenStream.getTracks()) {
        track.stop();
      }
      setScreenStream(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: shareScreenAudio
            ? {
                suppressLocalAudioPlayback: false,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              }
            : false,
        });

        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
        };

        setScreenStream(stream);
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
    }
  }, [screenStream, shareScreenAudio]);

  const setShareScreenAudioPreference = useCallback((includeAudio) => {
    setShareScreenAudio(includeAudio);
  }, []);

  return {
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
  };
}
