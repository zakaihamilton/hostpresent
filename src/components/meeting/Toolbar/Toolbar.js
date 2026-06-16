import { memo } from "react";
import {
  Mic,
  MicOff,
  ScreenShare,
  Stop,
  Video,
  VideoOff,
} from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { LayoutControls } from "./LayoutControls";
import { ProfileControls } from "./ProfileControls";
import { ScreenShareControls } from "./ScreenShareControls";
import styles from "./Toolbar.module.css";

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}

export const Toolbar = memo(function Toolbar({
  isAudioMuted,
  isVideoMuted,
  screenStream,
  shareScreenAudio,
  isScreenAudioShared,
  isGalleryVisible,
  isSidebarVisible,
  isPipVisible,
  isChatVisible,
  hasUnreadChat = false,
  displayName = "",
  onDisplayNameChange = null,
  participantMode = null,
  onParticipantModeChange = null,
  availableMicrophones = [],
  selectedMicrophone = "",
  onMicrophoneChange,
  availableSpeakers = [],
  selectedSpeaker = "",
  onSpeakerChange,
  availableCameras = [],
  selectedCamera = "",
  onCameraChange,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onShareScreenAudioChange,
  onToggleGallery,
  onToggleSidebar,
  onTogglePip,
  onToggleChat,
  isHost = false,
  onEndMeeting = null,
  onLeave = null,
  participantCount = 0,
  allowScreenShare = true,
  showRecording = false,
}) {
  return (
    <footer className={styles.toolbar}>
      <div className={styles.toolbarInner}>
        {/* Personal Settings & Controls (Left Zone) */}
        <div className={`${styles.controlGroup} ${styles.personalGroup}`}>
          {onDisplayNameChange
            ? <ProfileControls
                displayName={displayName}
                onDisplayNameChange={onDisplayNameChange}
                participantMode={participantMode}
                onParticipantModeChange={onParticipantModeChange}
                availableMicrophones={availableMicrophones}
                selectedMicrophone={selectedMicrophone}
                onMicrophoneChange={onMicrophoneChange}
                availableSpeakers={availableSpeakers}
                selectedSpeaker={selectedSpeaker}
                onSpeakerChange={onSpeakerChange}
                availableCameras={availableCameras}
                selectedCamera={selectedCamera}
                onCameraChange={onCameraChange}
              />
            : null}
        </div>

        {/* Primary Controls: Mic, Camera, Screen Share, End/Leave (Center Zone) */}
        <div className={`${styles.controlGroup} ${styles.primaryGroup}`}>
          <Tooltip
            text={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            <button
              type="button"
              className={btnClass(
                styles.mediaBtn,
                isAudioMuted && styles.btnDanger,
              )}
              onClick={onToggleAudio}
              aria-label={
                isAudioMuted ? "Unmute microphone" : "Mute microphone"
              }
            >
              {isAudioMuted ? <MicOff /> : <Mic />}
            </button>
          </Tooltip>

          <Tooltip text={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}>
            <button
              type="button"
              className={btnClass(
                styles.mediaBtn,
                isVideoMuted && styles.btnDanger,
              )}
              onClick={onToggleVideo}
              aria-label={isVideoMuted ? "Turn camera on" : "Turn camera off"}
            >
              {isVideoMuted ? <VideoOff /> : <Video />}
            </button>
          </Tooltip>

          {allowScreenShare
            ? <ScreenShareControls
                screenStream={screenStream}
                shareScreenAudio={shareScreenAudio}
                isScreenAudioShared={isScreenAudioShared}
                onToggleScreenShare={onToggleScreenShare}
                onShareScreenAudioChange={onShareScreenAudioChange}
              />
            : null}

          <Tooltip text={isHost ? "End Meeting for Everyone" : "Leave Meeting"}>
            <button
              type="button"
              className={btnClass(styles.btnDangerSolid, styles.exitBtn)}
              onClick={isHost ? onEndMeeting : onLeave}
              aria-label={isHost ? "End meeting" : "Leave meeting"}
            >
              <Stop />
              <span className={styles.btnLabel}>
                {isHost ? "End" : "Leave"}
              </span>
            </button>
          </Tooltip>
        </div>

        {/* Layout & Sidebar Panel Controls (Right Zone) */}
        <div className={`${styles.controlGroup} ${styles.layoutGroup}`}>
          <LayoutControls
            isGalleryVisible={isGalleryVisible}
            isSidebarVisible={isSidebarVisible}
            isPipVisible={isPipVisible}
            isChatVisible={isChatVisible}
            hasUnreadChat={hasUnreadChat}
            onToggleGallery={onToggleGallery}
            onToggleSidebar={onToggleSidebar}
            onTogglePip={onTogglePip}
            onToggleChat={onToggleChat}
            participantCount={participantCount}
          />
        </div>
      </div>
    </footer>
  );
});
