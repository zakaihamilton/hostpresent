import { memo } from "react";
import { Pause, Play, Record, Stop } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { LayoutControls } from "./LayoutControls";
import { MediaControls } from "./MediaControls";
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
  isRecording,
  isRecordingPaused,
  displayName = "",
  onDisplayNameChange = null,
  participantMode = null,
  onParticipantModeChange = null,
  availableMicrophones = [],
  selectedMicrophone = "",
  onMicrophoneChange,
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
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
  showRecording = true,
  allowScreenShare = true,
}) {
  return (
    <footer className={styles.toolbar}>
      <div className={styles.toolbarInner}>
        {onDisplayNameChange
          ? <div className={styles.controlGroup}>
              <ProfileControls
                displayName={displayName}
                onDisplayNameChange={onDisplayNameChange}
                participantMode={participantMode}
                onParticipantModeChange={onParticipantModeChange}
              />
            </div>
          : null}

        <div className={`${styles.controlGroup} ${styles.mediaGroup}`}>
          <MediaControls
            isAudioMuted={isAudioMuted}
            isVideoMuted={isVideoMuted}
            onToggleAudio={onToggleAudio}
            onToggleVideo={onToggleVideo}
            availableMicrophones={availableMicrophones}
            selectedMicrophone={selectedMicrophone}
            onMicrophoneChange={onMicrophoneChange}
            availableCameras={availableCameras}
            selectedCamera={selectedCamera}
            onCameraChange={onCameraChange}
          />
        </div>

        {allowScreenShare
          ? <div
              className={`${styles.controlGroup} ${styles.screenShareGroup}`}
            >
              <ScreenShareControls
                screenStream={screenStream}
                shareScreenAudio={shareScreenAudio}
                isScreenAudioShared={isScreenAudioShared}
                onToggleScreenShare={onToggleScreenShare}
                onShareScreenAudioChange={onShareScreenAudioChange}
              />
            </div>
          : null}

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
          />
        </div>

        {showRecording
          ? <div
              className={`${styles.controlGroup} ${styles.recordingGroup} ${isRecording ? styles.recordingGroupActive : ""} ${isRecordingPaused ? styles.recordingGroupPaused : ""}`}
            >
              {!isRecording
                ? <Tooltip text="Start Local Recording">
                    <button
                      type="button"
                      className={btnClass(styles.btnDanger)}
                      onClick={onStartRecording}
                    >
                      <Record />
                    </button>
                  </Tooltip>
                : <>
                    {isRecordingPaused
                      ? <Tooltip text="Resume Recording">
                          <button
                            type="button"
                            className={btnClass(styles.btnWarning)}
                            onClick={onResumeRecording}
                          >
                            <Play />
                          </button>
                        </Tooltip>
                      : <Tooltip text="Pause Recording">
                          <button
                            type="button"
                            className={btnClass()}
                            onClick={onPauseRecording}
                          >
                            <Pause />
                          </button>
                        </Tooltip>}

                    <Tooltip text="Stop & Save Recording">
                      <button
                        type="button"
                        className={btnClass(styles.btnDangerSolid)}
                        onClick={onStopRecording}
                      >
                        <Stop />
                      </button>
                    </Tooltip>
                  </>}
            </div>
          : null}
      </div>
    </footer>
  );
});
