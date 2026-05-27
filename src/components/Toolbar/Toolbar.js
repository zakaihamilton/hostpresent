import {
  Gallery,
  Mic,
  MicOff,
  Pause,
  Play,
  Record,
  ScreenShare,
  Stop,
  Users,
  Video,
  VideoOff,
} from "@/components/Icons";
import { Tooltip } from "@/components/Tooltip";
import styles from "./Toolbar.module.css";

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}

export function Toolbar({
  isAudioMuted,
  isVideoMuted,
  screenStream,
  isGalleryVisible,
  isSidebarVisible,
  isRecording,
  isRecordingPaused,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleGallery,
  onToggleSidebar,
  onStartRecording,
  onPauseRecording,
  onResumeRecording,
  onStopRecording,
}) {
  return (
    <footer className={styles.toolbar}>
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

      <div className={styles.controlGroup}>
        <Tooltip text={screenStream ? "Stop Screen Sharing" : "Share Screen"}>
          <button
            type="button"
            className={btnClass(screenStream && styles.btnActive)}
            onClick={onToggleScreenShare}
          >
            <ScreenShare />
          </button>
        </Tooltip>
      </div>

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

      <div className={styles.controlGroup}>
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
    </footer>
  );
}
