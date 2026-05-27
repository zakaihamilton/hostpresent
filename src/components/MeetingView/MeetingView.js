"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorBanner } from "@/components/ErrorBanner";
import { X } from "@/components/Icons";
import { Header } from "@/components/Header";
import { MeetingJoinError } from "@/components/MeetingJoinError";
import { MeetingLoading } from "@/components/MeetingLoading";
import { ParticipantsSidebar } from "@/components/ParticipantsSidebar";
import { PrimaryView } from "@/components/PrimaryView";
import { RecordingDownloadBanner } from "@/components/RecordingDownloadBanner";
import { Toolbar } from "@/components/Toolbar";
import { Tooltip } from "@/components/Tooltip";
import { VideoGallery } from "@/components/VideoGallery";
import {
  useConfirmDialog,
  useHostControls,
  useRoomDataChannel,
  useSessionTimers,
} from "@/hooks";
import { useRoomSession, ROOM_SESSION_STATUS } from "@/hooks/roomSession";
import { buildParticipantInviteLink } from "@/lib/room/inviteLink";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatJoinCode } from "@/lib/room/joinCodeFormat";
import {
  createHostAudioMutedMessage,
  createHostAudioUnmutedMessage,
  createHostVideoMutedMessage,
  createHostVideoUnmutedMessage,
  createParticipantAudioMutedMessage,
  createParticipantAudioUnmutedMessage,
  createParticipantProfileBroadcastMessage,
  createParticipantProfileMessage,
  createParticipantVideoMutedMessage,
  createParticipantVideoUnmutedMessage,
  createRecordingStateMessage,
  SIGNALING_MESSAGE,
} from "@/lib/signaling/messages";
import {
  loadDisplayName,
  loadParticipantMode,
  normalizeDisplayNameInput,
  PARTICIPANT_MODE,
  resolveDisplayName,
  saveDisplayName,
  saveParticipantMode,
} from "@/lib/settings/displayNameSettings";
import {
  getSignalingConfigHint,
  getSignalingErrorHint,
  isFatalSignalingError,
  isSignalingConfigError,
  isWaitingForHostMessage,
} from "@/lib/webrtc/peerClient";
import {
  pickOutboundVideoTrack,
  resolveOutboundAudioTrack,
} from "@/lib/webrtc/outboundMedia";
import styles from "./MeetingView.module.css";

function participantColor(id) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = id.charCodeAt(index) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360} 55% 45%)`;
}

export function MeetingView({ role, token, joinCode: routeJoinCode, onBack }) {
  const isHost = role === "host";

  const { status: sessionStatus, roomState, error: sessionError } = useRoomSession({
    role,
    token,
    enabled: Boolean(token),
  });

  const formattedRoomId = formatJoinCode(
    routeJoinCode ?? roomState?.joinCode ?? "",
  );

  const inviteLink =
    isHost && formattedRoomId
      ? buildParticipantInviteLink(routeJoinCode ?? roomState?.joinCode ?? "")
      : "";

  const [hostStream, setHostStream] = useState(null);
  const [inviteBarVisible, setInviteBarVisible] = useState(false);
  const [inviteCopyMessage, setInviteCopyMessage] = useState("");

  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const [videoParticipants, setVideoParticipants] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [shareScreenAudio, setShareScreenAudio] = useState(true);
  const [downloadState, setDownloadState] = useState(null);
  const [audioList, setAudioList] = useState([]);
  const [timersEnabled, setTimersEnabled] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(() => loadDisplayName());
  const [hostDisplayName, setHostDisplayName] = useState("Host");
  const [hostAudioMuted, setHostAudioMuted] = useState(false);
  const [hostVideoMuted, setHostVideoMuted] = useState(false);
  const [participantMode, setParticipantMode] = useState(() =>
    loadParticipantMode(),
  );
  const [peerParticipants, setPeerParticipants] = useState([]);

  const resolvedDisplayName = resolveDisplayName(displayNameInput);
  const participantProfilesRef = useRef(new Map());
  const roomConnectionRef = useRef(null);

  const { meetingSeconds, recordingSeconds, resetRecordingTimer } =
    useSessionTimers({
      isRecording,
      isRecordingPaused,
      enabled: timersEnabled,
    });

  const { confirm, dialogProps } = useConfirmDialog();

  const [hostPresent, setHostPresent] = useState(isHost);

  const handleRemoteHostStream = useCallback((stream) => {
    setHostStream(stream);
  }, []);

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
    [isHost],
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
    [isHost],
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
    [isHost],
  );

  const handleRemoteParticipant = useCallback(
    (participant) => {
      if (!participant?.id) return;

      if (participant.stream === null) {
        setVideoParticipants((previous) =>
          previous.filter((entry) => entry.id !== participant.id),
        );
        broadcastPeerLeft(participant.id);
        return;
      }

      const isNewConnection = participant.stream === undefined;

      setVideoParticipants((previous) => {
        const existing = previous.find((entry) => entry.id === participant.id);
        const nextName = participant.name
          ? resolveDisplayName(participant.name)
          : undefined;
        if (existing) {
          return previous.map((entry) =>
            entry.id === participant.id
              ? {
                  ...entry,
                  ...participant,
                  ...(nextName ? { name: nextName } : {}),
                  mode:
                    participant.mode ??
                    entry.mode ??
                    PARTICIPANT_MODE.AVAILABLE,
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
            mode: participant.mode ?? PARTICIPANT_MODE.AVAILABLE,
          },
        ];
      });

      if (isNewConnection) {
        syncProfilesToParticipant(participant.id);
      }
    },
    [broadcastPeerLeft, syncProfilesToParticipant],
  );

  const handlePeerProfileBroadcast = useCallback(
    (message) => {
      if (!message?.participantId) return;

      if (message.present === false) {
        setPeerParticipants((previous) =>
          previous.filter((entry) => entry.id !== message.participantId),
        );
        return;
      }

      setPeerParticipants((previous) => {
        const nextName = resolveDisplayName(message.displayName);
        const nextMode =
          message.mode === PARTICIPANT_MODE.LISTENING
            ? PARTICIPANT_MODE.LISTENING
            : PARTICIPANT_MODE.AVAILABLE;
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
    },
    [],
  );

  const handleDisplayNameChange = useCallback((value) => {
    const normalized = normalizeDisplayNameInput(value);
    setDisplayNameInput(normalized);
    saveDisplayName(normalized);
  }, []);

  const handleParticipantModeChange = useCallback((mode) => {
    setParticipantMode(mode);
    saveParticipantMode(mode);
  }, []);

  const roomConnection = useRoomDataChannel({
    role,
    token,
    roomId: roomState?.roomId ?? null,
    enabled: Boolean(token && roomState?.roomId),
    displayName: resolvedDisplayName,
    hostAudioMuted: isHost ? isAudioMuted : false,
    hostVideoMuted: isHost ? isVideoMuted : false,
    localStream,
    screenStream,
    onRemoteParticipant: isHost ? handleRemoteParticipant : undefined,
    onRemoteHostStream: isHost ? undefined : handleRemoteHostStream,
  });

  roomConnectionRef.current = roomConnection;

  const publishParticipantMediaStatus = useCallback(
    ({ audioMuted, videoMuted }) => {
      const participantId = roomConnection.localParticipantId;
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

  const handleBack = useCallback(() => {
    roomConnection.disconnect();
    onBack();
  }, [onBack, roomConnection.disconnect]);

  const fatalConnectionError =
    roomConnection.connectionError &&
    isFatalSignalingError(roomConnection.connectionError)
      ? roomConnection.connectionError
      : null;
  const signalingConfigError =
    fatalConnectionError && isSignalingConfigError(fatalConnectionError)
      ? fatalConnectionError
      : null;

  useEffect(() => {
    if (isHost) {
      setHostPresent(true);
      return;
    }
    setHostPresent(roomConnection.hostPresent);
  }, [isHost, roomConnection.hostPresent]);

  useEffect(() => {
    if (isHost) return undefined;

    return roomConnection.subscribe((message) => {
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
    });
  }, [isHost, roomConnection]);

  useEffect(() => {
    if (isHost) return undefined;

    return roomConnection.subscribe((message) => {
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
  }, [isHost, roomConnection]);

  useEffect(() => {
    if (isHost) return undefined;

    return roomConnection.subscribe((message) => {
      const localId = roomConnection.localParticipantId;

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
          if (message.participantId && message.participantId !== localId) return;
          localStream?.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
          setIsAudioMuted(true);
          publishParticipantMediaStatus({ audioMuted: true });
          break;
        case SIGNALING_MESSAGE.HOST_MUTE_VIDEO:
          if (message.participantId && message.participantId !== localId) return;
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
    roomConnection,
  ]);

  useEffect(() => {
    if (isHost || !roomConnection.localParticipantId) return;

    roomConnection.send(
      createParticipantProfileMessage({
        participantId: roomConnection.localParticipantId,
        displayName: resolvedDisplayName,
        mode: participantMode,
      }),
    );
  }, [
    isHost,
    participantMode,
    resolvedDisplayName,
    roomConnection,
    roomConnection.localParticipantId,
  ]);

  useEffect(() => {
    if (!isHost) return undefined;

    return roomConnection.subscribe((message) => {
      if (message.type !== SIGNALING_MESSAGE.PARTICIPANT_PROFILE) return;

      participantProfilesRef.current.set(message.participantId, {
        displayName: message.displayName,
        mode: message.mode,
      });

      handleRemoteParticipant({
        id: message.participantId,
        name: message.displayName,
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
    roomConnection,
  ]);

  const publishRecordingState = useCallback(
    (active, paused = false) => {
      if (!isHost) return;
      roomConnection.send(createRecordingStateMessage({ active, paused }));
    },
    [isHost, roomConnection],
  );

  useEffect(() => {
    if (!isHost || !isRecording) return;
    publishRecordingState(true, isRecordingPaused);
  }, [
    isHost,
    isRecording,
    isRecordingPaused,
    publishRecordingState,
    videoParticipants.length,
  ]);

  const {
    muteParticipantAudio,
    muteParticipantVideo,
    muteAllAudio,
    muteAllVideo,
    canMuteAllAudio,
    canMuteAllVideo,
  } = useHostControls({
    videoParticipants,
    audioList,
    setVideoParticipants,
    setAudioList,
    signaling: roomConnection,
    confirm,
    enabled: isHost,
  });

  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const downloadDismissTimerRef = useRef(null);
  const inviteCopyTimerRef = useRef(null);

  const isScreenAudioShared = Boolean(
    screenStream?.getAudioTracks().some((track) => track.readyState === "live"),
  );

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  useEffect(() => {
    setTimersEnabled(true);

    const initLocalMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
      } catch (err) {
        console.error("Failed to acquire camera/mic permissions:", err);
      }
    };
    initLocalMedia();

    return () => {
      if (downloadDismissTimerRef.current) {
        clearTimeout(downloadDismissTimerRef.current);
      }
      if (inviteCopyTimerRef.current) {
        clearTimeout(inviteCopyTimerRef.current);
      }
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
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      recordingChunksRef.current = [];
    };
  }, []);

  const toggleAudio = () => {
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
  };

  const toggleVideo = () => {
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
  };

  const toggleScreenShare = async () => {
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
            "Screen shared without audio. Enable “Share tab audio” in the browser picker, or turn on Share Audio before sharing.",
          );
        }
      } catch (err) {
        console.warn("Screen sharing failed:", err);
        if (err?.name === "NotAllowedError") {
          setErrorMsg(
            "Screen sharing was cancelled or denied. Allow screen capture and try again.",
          );
        } else {
          setErrorMsg(
            "Could not start screen sharing. Check browser permissions and try again.",
          );
        }
      }
    }
  };

  const setShareScreenAudioPreference = (includeAudio) => {
    setShareScreenAudio(includeAudio);
  };

  const dismissDownloadBanner = useCallback(() => {
    if (downloadDismissTimerRef.current) {
      clearTimeout(downloadDismissTimerRef.current);
      downloadDismissTimerRef.current = null;
    }
    setDownloadState(null);
  }, []);

  const updateDownloadProgress = useCallback((phase, progress, filename) => {
    setDownloadState({ phase, progress, filename });
  }, []);

  const finalizeRecordingDownload = useCallback(async () => {
    const filename = `Host-Present-Meeting-${new Date().toISOString().slice(0, 10)}.mp4`;
    const chunks = recordingChunksRef.current;
    const chunkCount = chunks.length;

    updateDownloadProgress("building", 15, filename);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    let processed = 0;
    for (let index = 0; index < chunkCount; index += 1) {
      processed += 1;
      const progress =
        15 + Math.round((processed / Math.max(chunkCount, 1)) * 55);
      updateDownloadProgress("building", progress, filename);
      if (index % 4 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const blob = new Blob(chunks, { type: "video/mp4" });
    updateDownloadProgress("saving", 85, filename);
    await new Promise((resolve) => setTimeout(resolve, 120));

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.style.display = "none";
    anchor.href = url;
    anchor.download = filename;

    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    }, 100);

    recordingChunksRef.current = [];
    updateDownloadProgress("complete", 100, filename);

    downloadDismissTimerRef.current = setTimeout(() => {
      setDownloadState(null);
      downloadDismissTimerRef.current = null;
    }, 5000);
  }, [updateDownloadProgress]);

  const startRecording = useCallback(async () => {
    if (!localStream || !isHost) return;

    const activeVideoTrack = pickOutboundVideoTrack(localStream, screenStream);
    const audioTrack = await resolveOutboundAudioTrack(localStream, screenStream);

    const tracksToRecord = [activeVideoTrack, audioTrack].filter(Boolean);
    const compositeStream = new MediaStream(tracksToRecord);

    let options = { mimeType: "video/mp4;codecs=avc1" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/mp4" };
    }

    let recorder;
    try {
      recorder = new MediaRecorder(compositeStream, options);
    } catch (e) {
      console.warn(
        "MP4 format not fully supported by browser, falling back to default.",
        e,
      );
      recorder = new MediaRecorder(compositeStream);
    }

    mediaRecorderRef.current = recorder;
    recordingChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      void finalizeRecordingDownload();
    };

    recorder.start(1000);
    resetRecordingTimer();
    setIsRecording(true);
    setIsRecordingPaused(false);
    publishRecordingState(true, false);
  }, [
    finalizeRecordingDownload,
    isHost,
    localStream,
    publishRecordingState,
    resetRecordingTimer,
    screenStream,
  ]);

  const pauseRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      setIsRecordingPaused(true);
      publishRecordingState(true, true);
    }
  };

  const resumeRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      setIsRecordingPaused(false);
      publishRecordingState(true, false);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      updateDownloadProgress("preparing", 5);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsRecordingPaused(false);
      resetRecordingTimer();
      publishRecordingState(false, false);
    }
  };

  const activeMainStream = screenStream || localStream;
  const viewingHostStream = !isHost && hostStream;
  const primaryStream = viewingHostStream ? hostStream : activeMainStream;
  const primaryLabel = viewingHostStream
    ? hostDisplayName
    : screenStream
      ? isScreenAudioShared
        ? "You are sharing your screen with audio"
        : "You are sharing your screen"
      : resolvedDisplayName;
  const primaryMuted = !viewingHostStream;

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;

    if (inviteCopyTimerRef.current) {
      clearTimeout(inviteCopyTimerRef.current);
    }

    const copied = await copyTextToClipboard(inviteLink);
    setInviteCopyMessage(copied ? "Copied!" : "Copy failed");

    inviteCopyTimerRef.current = setTimeout(() => {
      setInviteCopyMessage("");
      inviteCopyTimerRef.current = null;
    }, 2500);
  };

  const inviteCopyButtonLabel = inviteCopyMessage || "Copy link";
  const shareButtonClassName = [
    styles.shareButton,
    inviteCopyMessage === "Copied!" && styles.shareButtonSuccess,
    inviteCopyMessage === "Copy failed" && styles.shareButtonError,
  ]
    .filter(Boolean)
    .join(" ");

  if (sessionStatus === ROOM_SESSION_STATUS.LOADING) {
    return <MeetingLoading message="Loading room…" />;
  }

  if (sessionStatus === ROOM_SESSION_STATUS.ERROR) {
    return (
      <MeetingJoinError
        title="Could not join meeting"
        message={sessionError || "Failed to load room session."}
        onBack={handleBack}
      />
    );
  }

  if (signalingConfigError) {
    return (
      <MeetingJoinError
        title="Signaling not configured"
        message={signalingConfigError}
        hint={getSignalingConfigHint()}
        onBack={handleBack}
      />
    );
  }

  if (fatalConnectionError) {
    return (
      <MeetingJoinError
        title="Could not connect to meeting"
        message={fatalConnectionError}
        hint={getSignalingErrorHint(fatalConnectionError, { isHost })}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className={styles.app}>
      {isRecording && (
        <div
          className={`${styles.recordingBar} ${isRecordingPaused ? styles.recordingBarPaused : ""}`}
          aria-hidden
        />
      )}

      <Header
        meetingDurationSeconds={meetingSeconds}
        roomId={formattedRoomId || null}
        isRecording={isRecording}
        isRecordingPaused={isRecordingPaused}
        recordingDurationSeconds={recordingSeconds}
        onBack={handleBack}
        backLabel={isHost ? "Back to welcome" : "Back to join screen"}
        onShowInviteLink={
          isHost && inviteLink && !inviteBarVisible
            ? () => setInviteBarVisible(true)
            : null
        }
      />

      {!isHost && !hostPresent && roomConnection.connectionError
        ? <div className={styles.hostWaitingBanner} role="status">
            <p className={styles.hostWaitingText}>
              {roomConnection.connectionError}
            </p>
          </div>
        : null}

      {!isHost && !hostPresent && !roomConnection.connectionError
        ? <div className={styles.hostWaitingBanner} role="status">
            <p className={styles.hostWaitingText}>Waiting for the host to join…</p>
          </div>
        : null}

      {roomConnection.connectionError &&
      !isHost &&
      !isWaitingForHostMessage(roomConnection.connectionError) &&
      !fatalConnectionError
        ? <div className={styles.signalingErrorBanner} role="alert">
            <p className={styles.signalingErrorText}>
              {roomConnection.connectionError}
            </p>
          </div>
        : null}

      {isHost &&
      roomConnection.connectionError &&
      !fatalConnectionError
        ? <div className={styles.signalingErrorBanner} role="alert">
            <p className={styles.signalingErrorText}>
              {roomConnection.connectionError}
            </p>
          </div>
        : null}

      {isHost && inviteLink && inviteBarVisible
        ? <div className={styles.shareBar}>
            <input
              className={styles.shareInput}
              readOnly
              value={inviteLink}
              aria-label="Participant invite link"
              onFocus={(event) => event.currentTarget.select()}
            />
            <div className={styles.shareActions}>
              <button
                type="button"
                className={shareButtonClassName}
                onClick={handleCopyInviteLink}
                aria-live="polite"
              >
                {inviteCopyButtonLabel}
              </button>
              <Tooltip text="Hide invite link" placement="top">
                <button
                  type="button"
                  className={styles.shareDismiss}
                  onClick={() => setInviteBarVisible(false)}
                  aria-label="Hide invite link"
                >
                  <X size={18} />
                </button>
              </Tooltip>
            </div>
          </div>
        : null}

      <main className={styles.workspace}>
        {isSidebarVisible ? (
          <button
            type="button"
            className={styles.sidebarBackdrop}
            aria-label="Close participants panel"
            onClick={() => setIsSidebarVisible(false)}
          />
        ) : null}

        <div className={styles.stage}>
          <ErrorBanner message={errorMsg} onDismiss={() => setErrorMsg("")} />

          <RecordingDownloadBanner
            downloadState={downloadState}
            onDismiss={dismissDownloadBanner}
          />

          <VideoGallery
            visible={isGalleryVisible}
            screenStream={screenStream}
            localStream={localStream}
            participants={videoParticipants}
            isAudioMuted={isAudioMuted}
            localDisplayName={resolvedDisplayName}
          />

          <PrimaryView
            stream={primaryStream}
            label={primaryLabel}
            isMuted={primaryMuted}
            isAudioMuted={viewingHostStream ? hostAudioMuted : false}
            isVideoMuted={viewingHostStream ? hostVideoMuted : false}
            isRecording={isRecording}
            isRecordingPaused={isRecordingPaused}
            recordingDurationSeconds={recordingSeconds}
          />
        </div>

        <ParticipantsSidebar
          visible={isSidebarVisible}
          audioList={audioList}
          videoParticipants={videoParticipants}
          peerParticipants={peerParticipants}
          hostDisplayName={hostDisplayName}
          hostIsAudioMuted={hostAudioMuted}
          hostIsVideoMuted={hostVideoMuted}
          isVideoMuted={isVideoMuted}
          isAudioMuted={isAudioMuted}
          isHost={isHost}
          localDisplayName={displayNameInput}
          localParticipantMode={participantMode}
          onClose={() => setIsSidebarVisible(false)}
          onMuteParticipantVideo={muteParticipantVideo}
          onMuteParticipantAudio={muteParticipantAudio}
          onMuteAllVideo={muteAllVideo}
          onMuteAllAudio={muteAllAudio}
          canMuteAllVideo={canMuteAllVideo}
          canMuteAllAudio={canMuteAllAudio}
        />
      </main>

      <ConfirmDialog {...dialogProps} />

      <Toolbar
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        screenStream={screenStream}
        shareScreenAudio={shareScreenAudio}
        isScreenAudioShared={isScreenAudioShared}
        isGalleryVisible={isGalleryVisible}
        isSidebarVisible={isSidebarVisible}
        isRecording={isRecording}
        isRecordingPaused={isRecordingPaused}
        displayName={displayNameInput}
        onDisplayNameChange={handleDisplayNameChange}
        participantMode={!isHost ? participantMode : null}
        onParticipantModeChange={!isHost ? handleParticipantModeChange : null}
        showRecording={isHost}
        allowScreenShare={isHost}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onShareScreenAudioChange={setShareScreenAudioPreference}
        onToggleGallery={() => setIsGalleryVisible(!isGalleryVisible)}
        onToggleSidebar={() => setIsSidebarVisible(!isSidebarVisible)}
        onStartRecording={startRecording}
        onPauseRecording={pauseRecording}
        onResumeRecording={resumeRecording}
        onStopRecording={stopRecording}
      />
    </div>
  );
}
