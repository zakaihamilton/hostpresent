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
import { prepareOutboundAudioMix } from "@/lib/webrtc/outboundMedia";

const VOICE_ISOLATION_STORAGE_KEY = "hostpresent.voiceIsolation";

const AUDIO_PROCESSING_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

function audioConstraintsForDevice(deviceId, voiceIsolationEnabled = true) {
  return {
    ...AUDIO_PROCESSING_CONSTRAINTS,
    voiceIsolation: voiceIsolationEnabled,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
}

function loadVoiceIsolationPreference() {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(VOICE_ISOLATION_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function MediaControls({
  isHost,
  roomConnection,
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
  const [isVoiceIsolationEnabled, setIsVoiceIsolationEnabled] = useState(
    loadVoiceIsolationPreference,
  );
  const [isVoiceIsolationChanging, setIsVoiceIsolationChanging] =
    useState(false);
  const [availableSpeakers, setAvailableSpeakers] = useState([]);
  const [selectedSpeaker, setSelectedSpeaker] = useState("");

  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const activeScreenStreamRef = useRef(screenStream);
  const initialAudioMutedRef = useRef(isAudioMuted);
  const initialVideoMutedRef = useRef(isVideoMuted);
  const initialVoiceIsolationRef = useRef(isVoiceIsolationEnabled);
  const hadScreenStreamRef = useRef(Boolean(screenStream));
  const syncOutboundMediaRef = useRef(roomConnection?.syncOutboundMedia);
  syncOutboundMediaRef.current = roomConnection?.syncOutboundMedia;

  const isScreenAudioShared = Boolean(
    screenStream?.getAudioTracks().some((track) => track.readyState === "live"),
  );

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Wait for the screen-stream state to reach roomDataChannel before syncing.
  // Calling sync directly after setScreenStream() uses the previous stream, so
  // viewers keep receiving the camera when sharing starts (and the screen when
  // it stops).
  useEffect(() => {
    screenStreamRef.current = screenStream;
    activeScreenStreamRef.current = screenStream;
    if (!screenStream && !hadScreenStreamRef.current) return;

    hadScreenStreamRef.current = Boolean(screenStream);
    void syncOutboundMediaRef.current?.();
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
    let cancelled = false;
    let acquiredStream = null;

    const initLocalMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
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
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !initialAudioMutedRef.current;
        });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = !initialVideoMutedRef.current;
        });
        setLocalStream(stream);
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
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
  }, [setLocalStream]);

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
          audio: audioConstraintsForDevice(deviceId, isVoiceIsolationEnabled),
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
    [isAudioMuted, isVoiceIsolationEnabled, localStream, roomConnection],
  );

  const setVoiceIsolation = useCallback(
    async (enabled) => {
      if (enabled === isVoiceIsolationEnabled) return;

      const previousValue = isVoiceIsolationEnabled;
      setIsVoiceIsolationEnabled(enabled);
      try {
        window.localStorage.setItem(
          VOICE_ISOLATION_STORAGE_KEY,
          String(enabled),
        );
      } catch {}

      if (!localStream) return;

      const currentTrack = localStream.getAudioTracks()[0];
      const deviceId =
        selectedMicrophone || currentTrack?.getSettings?.().deviceId || "";

      setIsVoiceIsolationChanging(true);
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraintsForDevice(deviceId, enabled),
          video: false,
        });
        const newTrack = newStream.getAudioTracks()[0];
        if (!newTrack) throw new Error("No microphone track returned");

        if (currentTrack) {
          localStream.removeTrack(currentTrack);
          currentTrack.stop();
        }
        localStream.addTrack(newTrack);
        newTrack.enabled = !isAudioMuted;
        void roomConnection.syncOutboundMedia?.();
      } catch (err) {
        console.error("Failed to update voice isolation:", err);
        setIsVoiceIsolationEnabled(previousValue);
        try {
          window.localStorage.setItem(
            VOICE_ISOLATION_STORAGE_KEY,
            String(previousValue),
          );
        } catch {}
        setErrorMsg(
          "[E048] Could not update voice isolation. Check microphone permissions and try again.",
        );
      } finally {
        setIsVoiceIsolationChanging(false);
      }
    },
    [
      isAudioMuted,
      isVoiceIsolationEnabled,
      localStream,
      roomConnection,
      selectedMicrophone,
    ],
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

  const stopScreenShare = useCallback(
    (streamToStop) => {
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
      void roomConnection.syncOutboundMedia?.({ screenStream: null });
      publishScreenShareStatus(false);

      if (streamToStop) {
        for (const track of streamToStop.getTracks()) {
          if (track.readyState !== "ended") track.stop();
        }
      }
    },
    [publishScreenShareStatus, roomConnection, setScreenStream],
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
      stopScreenShare(screenStream);
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
    }
  }, [
    localStream,
    publishScreenShareStatus,
    screenStream,
    shareScreenAudio,
    setScreenStream,
    stopScreenShare,
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
    isVoiceIsolationEnabled,
    isVoiceIsolationChanging,
    setVoiceIsolation,
    availableSpeakers,
    selectedSpeaker,
    switchSpeaker,
  };
}
