import { Logo } from "@/components/Icons";
import styles from "./Header.module.css";

export function Header({ timeString, isRecording, isRecordingPaused }) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <Logo />
        Host Present
      </div>
      <div className={styles.meta}>
        <span className={styles.timeDisplay}>{timeString}</span>
        <span className={styles.separator}>|</span>
        <span>End-to-end Encrypted</span>
        {isRecording && (
          <div
            className={`${styles.recordingIndicator} ${isRecordingPaused ? styles.paused : ""}`}
          >
            <div className={styles.recordingDot} />
            {isRecordingPaused ? "Paused" : "Recording"}
          </div>
        )}
      </div>
    </header>
  );
}
