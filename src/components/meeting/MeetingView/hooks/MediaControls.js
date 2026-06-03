import { useCallback, useEffect, useRef, useState } from "react";
import {
  createHostAudioMutedMessage,
  createHostAudioUnmutedMessage,
  createHostVideoMutedMessage,
  createHostVideoUnmutedMessage,
  createParticipantAudioMutedMessage,
  createParticipantAudioUnmutedMessage,
  createParticipantScreenShareStartedMessage,
  createParticipantScreenShareStoppedMessage,
  createParticipantVideoMutedMessage,
  createParticipantVideoUnmutedMessage,
} from "@/lib/signaling/messages";

const VOICE_ISOLATION_AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceIsolation: true,
};

function audioConstraintsForDevice(deviceId) {
  return {
    ...VOICE_ISOLATION_AUDIO_CONSTRAINTS,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
}

export function MediaControls({
  isHost,
  roomConnection,
  streamListenerCleanupsRef,
  localStream,
  setLocalStream,
  screenStream,
  setScreenStream,
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
  const [errorMsg, setErrorMsg] = useState("");
  const [shareScreenAudio, setShareScreenAudio] = useState(true);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [availableMicrophones, setAvailableMicrophones] = useState([]);
  const [selectedMicrophone, setSelectedMicrophone] = useState("");
  const [availableSpeakers, setAvailableSpeakers] = useState([]);
  const [selectedSpeaker, setSelectedSpeaker] = useState("");

  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenAudioRef = useRef(null);

  const isScreenAudioShared = Boolean(
    screenStream?.getAudioTracks().some((track) => track.readyState === "live"),
  );

  useEffect(() => {
    if (screenAudioRef.current) {
      screenAudioRef.current.pause();
      screenAudioRef.current.srcObject = null;
      screenAudioRef.current = null;
    }

    if (screenStream) {
      const audioTrack = screenStream.getAudioTracks()[0];
      if (audioTrack && audioTrack.readyState === "live") {
        const audioEl = new Audio();
        audioEl.srcObject = screenStream;
        if (selectedSpeaker && typeof audioEl.setSinkId === "function") {
          audioEl.setSinkId(selectedSpeaker).catch(() => {});
        }
        audioEl.play().catch(() => {});
        screenAudioRef.current = audioEl;
      }
    }

    return () => {
      if (screenAudioRef.current) {
        screenAudioRef.current.pause();
        screenAudioRef.current.srcObject = null;
        screenAudioRef.current = null;
      }
    };
  }, [screenStream, selectedSpeaker]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  const enumerateMediaDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableCameras(devices.filter((d) => d.kind === "videoinput"));
      setAvailableMicrophones(devices.filter((d) => d.kind === "audioinput"));
      setAvailableSpeakers(devices.filter((d) => d.kind === "audiooutput"));
    } catch {
      // ignore enumeration errors
    }
  }, []);

  useEffect(() => {
    navigator.mediaDevices.addEventListener(
      "devicechange",
      enumerateMediaDevices,
    );
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        enumerateMediaDevices,
      );
    };
  }, [enumerateMediaDevices]);

  useEffect(() => {
    const initLocalMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: audioConstraintsForDevice(),
        });
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !isAudioMuted;
        });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = !isVideoMuted;
        });
        setLocalStream(stream);
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        const audioInputs = devices.filter((d) => d.kind === "audioinput");
        const audioOutputs = devices.filter((d) => d.kind === "audiooutput");
        setAvailableCameras(videoInputs);
        setAvailableMicrophones(audioInputs);
        setAvailableSpeakers(audioOutputs);
        if (videoInputs.length > 0) {
          const currentId = stream.getVideoTracks()[0]?.getSettings().deviceId;
          setSelectedCamera(currentId || videoInputs[0].deviceId);
        }
        if (audioInputs.length > 0) {
          const currentId = stream.getAudioTracks()[0]?.getSettings().deviceId;
          setSelectedMicrophone(currentId || audioInputs[0].deviceId);
        }
        if (audioOutputs.length > 0) {
          setSelectedSpeaker(audioOutputs[0].deviceId);
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
  }, [isAudioMuted, isVideoMuted, setLocalStream]); // eslint-disable-line react-hooks/exhaustive-deps

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
        void roomConnection.syncOutboundMedia?.();
      } catch (err) {
        console.error("Failed to switch camera:", err);
        setErrorMsg(
          "[E040] Could not switch camera. Check permissions and try again.",
        );
      }
    },
    [localStream, isVideoMuted, roomConnection],
  );

  const acquireReplacementVideoTrack = useCallback(async () => {
    if (!localStream || !navigator.mediaDevices) return null;

    const constraints = selectedCamera
      ? { deviceId: { exact: selectedCamera } }
      : true;
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: constraints,
      audio: false,
    });
    const newTrack = newStream.getVideoTracks()[0] ?? null;
    if (!newTrack) {
      for (const track of newStream.getTracks()) {
        track.stop();
      }
      return null;
    }

    for (const track of localStream.getVideoTracks()) {
      localStream.removeTrack(track);
      track.stop();
    }
    localStream.addTrack(newTrack);
    return newTrack;
  }, [localStream, selectedCamera]);

  const switchMicrophone = useCallback(
    async (deviceId) => {
      if (!localStream || !deviceId || !navigator.mediaDevices) return;

      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack?.getSettings().deviceId === deviceId) return;

      const wasMuted = isAudioMuted;

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraintsForDevice(deviceId),
          video: false,
        });

        const newTrack = newStream.getAudioTracks()[0];
        if (audioTrack) {
          localStream.removeTrack(audioTrack);
          audioTrack.stop();
        }
        localStream.addTrack(newTrack);
        newTrack.enabled = !wasMuted;
        setSelectedMicrophone(deviceId);
        void roomConnection.syncOutboundMedia?.();
      } catch (err) {
        console.error("Failed to switch microphone:", err);
        setErrorMsg(
          "[E044] Could not switch microphone. Check permissions and try again.",
        );
      }
    },
    [localStream, isAudioMuted, roomConnection],
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

  const publishScreenShareStatus = useCallback(
    (screenSharing) => {
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

  const toggleAudio = useCallback(() => {
    if (!localStream) return;

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    const nextMuted = !localStream.getAudioTracks()[0]?.enabled;
    setIsAudioMuted(nextMuted);
    try {
      window.localStorage.setItem("hostpresent.audioMuted", String(nextMuted));
    } catch {}

    void roomConnection.syncOutboundMedia?.();

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

      void roomConnection.syncOutboundMedia?.();

      if (isHost) {
        roomConnection.send(
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

  const toggleScreenShare = useCallback(async () => {
    if (screenStream) {
      for (const track of screenStream.getTracks()) {
        track.stop();
      }
      setScreenStream(null);
      publishScreenShareStatus(false);
      void roomConnection.syncOutboundMedia?.();
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: shareScreenAudio
            ? {
                suppressLocalAudioPlayback: true,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              }
            : false,
        });

        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
          publishScreenShareStatus(false);
          void roomConnection.syncOutboundMedia?.();
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
    }
  }, [
    publishScreenShareStatus,
    roomConnection,
    screenStream,
    shareScreenAudio,
    setScreenStream,
  ]);

  const setShareScreenAudioPreference = useCallback((includeAudio) => {
    setShareScreenAudio(includeAudio);
  }, []);

  const switchSpeaker = useCallback((deviceId) => {
    setSelectedSpeaker(deviceId || "");
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
    availableMicrophones,
    selectedMicrophone,
    switchMicrophone,
    availableSpeakers,
    selectedSpeaker,
    switchSpeaker,
  };
}
