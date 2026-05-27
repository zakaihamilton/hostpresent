import {
  Gallery,
  Mic,
  MicOff,
  Pause,
  Play,
  Record,
  Stop,
  Users,
  Video,
  VideoOff,
} from "@/components/Icons";
import { ProfileControls } from "./ProfileControls";
import { ScreenShareControls } from "./ScreenShareControls";
import { Tooltip } from "@/components/Tooltip";
import styles from "./Toolbar.module.css";

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}

export function Toolbar({
  isAudioMuted,
  isVideoMuted,
  screenStream,
  shareScreenAudio,
  isScreenAudioShared,
  isGalleryVisible,
  isSidebarVisible,
  isRecording,
  isRecordingPaused,
  displayName = "",
  onDisplayNameChange = null,
  participantMode = null,
  onParticipantModeChange = null,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onShareScreenAudioChange,
  onToggleGallery,
  onToggleSidebar,
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

      <div className={styles.controlGroup}>
        <Tooltip text={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}>
          <button
            type="button"
            className={btnClass(isAudioMuted && styles.btnDanger)}
            onClick={onToggleAudio}
          >
            {isAudioMuted ? <MicOff /> : <Mic />}
          </button>
        </Tooltip>

        <Tooltip text={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}>
          <button
            type="button"
            className={btnClass(isVideoMuted && styles.btnDanger)}
            onClick={onToggleVideo}
          >
            {isVideoMuted ? <VideoOff /> : <Video />}
          </button>
        </Tooltip>
      </div>

      {allowScreenShare
        ? <div className={`${styles.controlGroup} ${styles.screenShareGroup}`}>
            <ScreenShareControls
              screenStream={screenStream}
              shareScreenAudio={shareScreenAudio}
              isScreenAudioShared={isScreenAudioShared}
              onToggleScreenShare={onToggleScreenShare}
              onShareScreenAudioChange={onShareScreenAudioChange}
            />
          </div>
        : null}

      <div className={styles.controlGroup}>
        <Tooltip
          text={isGalleryVisible ? "Hide Video Gallery" : "Show Video Gallery"}
        >
          <button
            type="button"
            className={btnClass(isGalleryVisible && styles.btnActive)}
            onClick={onToggleGallery}
          >
            <Gallery />
          </button>
        </Tooltip>

        <Tooltip
          text={isSidebarVisible ? "Hide Participants" : "Show Participants"}
        >
          <button
            type="button"
            className={btnClass(isSidebarVisible && styles.btnActive)}
            onClick={onToggleSidebar}
          >
            <Users />
          </button>
        </Tooltip>
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
}
