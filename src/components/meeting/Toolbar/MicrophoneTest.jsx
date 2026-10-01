import styles from "./MediaControls.module.css";

export function MicrophoneTest({
  handleTestMicrophone,
  availableMicrophones,
  micTestState,
  micTestStatus,
  micTestLevel,
}) {
  return (
    <div className={styles.micTest}>
      <div className={styles.micTestControls}>
        <button
          type="button"
          className={styles.testButton}
          onClick={handleTestMicrophone}
          disabled={
            availableMicrophones.length === 0 || micTestState === "testing"
          }
        >
          {micTestState === "testing" ? "Testing..." : "Test microphone"}
        </button>
        <p className={styles.micTestStatus} aria-live="polite">
          {micTestStatus}
        </p>
      </div>
      <div className={styles.micMeter} aria-hidden>
        <span
          className={styles.micMeterBar}
          style={{
            transform: `scaleX(${Math.max(0.04, micTestLevel)})`,
          }}
        />
      </div>
    </div>
  );
}
