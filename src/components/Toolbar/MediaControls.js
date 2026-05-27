import { Mic, MicOff, Video, VideoOff } from "@/components/Icons";
import { Tooltip } from "@/components/Tooltip";
import styles from "./MediaControls.module.css";

function btnClass(...classes) {
  return [styles.btn, ...classes.filter(Boolean)].join(" ");
}

export function MediaControls({
  isAudioMuted,
  isVideoMuted,
  onToggleAudio,
  onToggleVideo,
}) {
  return (
    <div className={styles.cluster}>
      <Tooltip text={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}>
        <button
          type="button"
          className={btnClass(styles.audioBtn, isAudioMuted && styles.btnDanger)}
          onClick={onToggleAudio}
          aria-label={isAudioMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isAudioMuted ? <MicOff /> : <Mic />}
        </button>
      </Tooltip>

      <Tooltip text={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}>
        <button
          type="button"
          className={btnClass(styles.videoBtn, isVideoMuted && styles.btnDanger)}
          onClick={onToggleVideo}
          aria-label={isVideoMuted ? "Turn camera on" : "Turn camera off"}
        >
          {isVideoMuted ? <VideoOff /> : <Video />}
        </button>
      </Tooltip>
    </div>
  );
}
