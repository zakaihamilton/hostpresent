import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
import type { RoomMediaControlsConnection } from "@/hooks/roomDataChannel/types";
import { PUBLISHER_VIDEO_CONSTRAINTS } from "@/lib/webrtc/audienceQuality";

const VOICE_ISOLATION_STORAGE_KEY = "hostpresent.voiceIsolation";

const AUDIO_PROCESSING_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export function audioConstraintsForDevice(
  deviceId?: string,
  voiceIsolationEnabled = true,
) {
  return {
    ...AUDIO_PROCESSING_CONSTRAINTS,
    voiceIsolation: voiceIsolationEnabled,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
}

export function loadVoiceIsolationPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(VOICE_ISOLATION_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function useMediaDeviceSelection({
  localStream,
  isAudioMuted,
  isVideoMuted,
  roomConnection,
  publishingAllowedRef,
  keepAcquiredStream,
  setLocalTrackRevision,
  setErrorMsg,
}: {
  localStream?: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  roomConnection?: RoomMediaControlsConnection;
  publishingAllowedRef: MutableRefObject<boolean>;
  keepAcquiredStream: (stream: MediaStream) => boolean;
  setLocalTrackRevision: Dispatch<SetStateAction<number>>;
  setErrorMsg: Dispatch<SetStateAction<string>>;
}) {
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>(
    [],
  );
  const [selectedCamera, setSelectedCamera] = useState("");
  const [availableMicrophones, setAvailableMicrophones] = useState<
    MediaDeviceInfo[]
  >([]);
  const [selectedMicrophone, setSelectedMicrophone] = useState("");
  const [isVoiceIsolationEnabled, setIsVoiceIsolationEnabled] = useState(
    loadVoiceIsolationPreference,
  );
  const [isVoiceIsolationChanging, setIsVoiceIsolationChanging] =
    useState(false);
  const [availableSpeakers, setAvailableSpeakers] = useState<MediaDeviceInfo[]>(
    [],
  );
  const [selectedSpeaker, setSelectedSpeaker] = useState("");

  const syncEnumeratedDevices = useCallback(
    (devices: MediaDeviceInfo[], stream?: MediaStream | null) => {
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      const audioOutputs = devices.filter((d) => d.kind === "audiooutput");
      setAvailableCameras(videoInputs);
      setAvailableMicrophones(audioInputs);
      setAvailableSpeakers(audioOutputs);
      if (!stream) return;
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
    },
    [],
  );

  const enumerateMediaDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      syncEnumeratedDevices(devices);
    } catch {
      // ignore enumeration errors
    }
  }, [syncEnumeratedDevices]);

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

  const switchCamera = useCallback(
    async (deviceId: string) => {
      if (
        !publishingAllowedRef.current ||
        !localStream ||
        !deviceId ||
        !navigator.mediaDevices
      )
        return;

      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack?.getSettings().deviceId === deviceId) return;

      const wasMuted = isVideoMuted;

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...PUBLISHER_VIDEO_CONSTRAINTS,
            deviceId: { exact: deviceId },
          },
          audio: false,
        });

        if (!keepAcquiredStream(newStream)) return;
        const newTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
          localStream.removeTrack(videoTrack);
          videoTrack.stop();
        }
        localStream.addTrack(newTrack);
        setLocalTrackRevision((revision) => revision + 1);
        newTrack.enabled = !wasMuted;
        setSelectedCamera(deviceId);
        void roomConnection?.syncOutboundMedia?.();
      } catch (err) {
        console.error("Failed to switch camera:", err);
        setErrorMsg(
          "[E040] Could not switch camera. Check permissions and try again.",
        );
      }
    },
    [
      isVideoMuted,
      keepAcquiredStream,
      localStream,
      publishingAllowedRef,
      roomConnection,
      setErrorMsg,
      setLocalTrackRevision,
    ],
  );

  const acquireReplacementVideoTrack = useCallback(async () => {
    if (
      !publishingAllowedRef.current ||
      !localStream ||
      !navigator.mediaDevices
    )
      return null;

    const constraints = selectedCamera
      ? { ...PUBLISHER_VIDEO_CONSTRAINTS, deviceId: { exact: selectedCamera } }
      : PUBLISHER_VIDEO_CONSTRAINTS;
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: constraints,
      audio: false,
    });
    if (!keepAcquiredStream(newStream)) return null;
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
    setLocalTrackRevision((revision) => revision + 1);
    return newTrack;
  }, [
    keepAcquiredStream,
    localStream,
    publishingAllowedRef,
    selectedCamera,
    setLocalTrackRevision,
  ]);

  const switchMicrophone = useCallback(
    async (deviceId: string) => {
      if (
        !publishingAllowedRef.current ||
        !localStream ||
        !deviceId ||
        !navigator.mediaDevices
      )
        return;

      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack?.getSettings().deviceId === deviceId) return;

      const wasMuted = isAudioMuted;

      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraintsForDevice(deviceId, isVoiceIsolationEnabled),
          video: false,
        });

        if (!keepAcquiredStream(newStream)) return;
        const newTrack = newStream.getAudioTracks()[0];
        if (audioTrack) {
          localStream.removeTrack(audioTrack);
          audioTrack.stop();
        }
        localStream.addTrack(newTrack);
        setLocalTrackRevision((revision) => revision + 1);
        newTrack.enabled = !wasMuted;
        setSelectedMicrophone(deviceId);
        void roomConnection?.syncOutboundMedia?.();
      } catch (err) {
        console.error("Failed to switch microphone:", err);
        setErrorMsg(
          "[E044] Could not switch microphone. Check permissions and try again.",
        );
      }
    },
    [
      isAudioMuted,
      isVoiceIsolationEnabled,
      keepAcquiredStream,
      localStream,
      publishingAllowedRef,
      roomConnection,
      setErrorMsg,
      setLocalTrackRevision,
    ],
  );

  const setVoiceIsolation = useCallback(
    async (enabled: boolean) => {
      if (enabled === isVoiceIsolationEnabled) return;

      const previousValue = isVoiceIsolationEnabled;
      setIsVoiceIsolationEnabled(enabled);
      try {
        window.localStorage.setItem(
          VOICE_ISOLATION_STORAGE_KEY,
          String(enabled),
        );
      } catch {}

      if (!publishingAllowedRef.current || !localStream) return;

      const currentTrack = localStream.getAudioTracks()[0];
      const deviceId =
        selectedMicrophone || currentTrack?.getSettings?.().deviceId || "";

      setIsVoiceIsolationChanging(true);
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraintsForDevice(deviceId, enabled),
          video: false,
        });
        if (!keepAcquiredStream(newStream)) return;
        const newTrack = newStream.getAudioTracks()[0];
        if (!newTrack) throw new Error("No microphone track returned");

        if (currentTrack) {
          localStream.removeTrack(currentTrack);
          currentTrack.stop();
        }
        localStream.addTrack(newTrack);
        setLocalTrackRevision((revision) => revision + 1);
        newTrack.enabled = !isAudioMuted;
        void roomConnection?.syncOutboundMedia?.();
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
      keepAcquiredStream,
      localStream,
      publishingAllowedRef,
      roomConnection,
      selectedMicrophone,
      setErrorMsg,
      setLocalTrackRevision,
    ],
  );

  const switchSpeaker = useCallback((deviceId?: string) => {
    setSelectedSpeaker(deviceId || "");
  }, []);

  return {
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
  };
}
