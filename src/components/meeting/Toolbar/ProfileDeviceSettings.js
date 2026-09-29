import { CustomSelect } from "@/components/ui/CustomSelect";
import styles from "./ProfileControls.module.css";

export function ProfileDeviceSettings({
  availableMicrophones,
  selectedMicrophone,
  onMicrophoneChange,
  isVoiceIsolationEnabled,
  isVoiceIsolationChanging,
  onVoiceIsolationChange,
  availableSpeakers,
  selectedSpeaker,
  onSpeakerChange,
  availableCameras,
  selectedCamera,
  onCameraChange,
  micTestState,
  micTestLevel,
  micTestStatus,
  handleTestMicrophone,
}) {
  return (
    <section className={styles.popupSection}>
      <p className={styles.popupHeading}>Audio & video devices</p>

      <div className={styles.deviceField}>
        <label className={styles.deviceLabel} htmlFor="microphone-device">
          Microphone
        </label>
        {availableMicrophones.length === 0
          ? <p className={styles.emptyDevices}>No microphones detected</p>
          : <CustomSelect
              id="microphone-device"
              label="Microphone"
              value={selectedMicrophone}
              options={availableMicrophones.map((mic) => ({
                value: mic.deviceId,
                label: mic.label || "Microphone",
              }))}
              onChange={onMicrophoneChange}
            />}

        <label className={styles.voiceIsolationToggle}>
          <input
            type="checkbox"
            checked={isVoiceIsolationEnabled}
            disabled={
              availableMicrophones.length === 0 || isVoiceIsolationChanging
            }
            onChange={(event) => onVoiceIsolationChange?.(event.target.checked)}
          />
          <span className={styles.voiceIsolationCopy}>
            <span className={styles.voiceIsolationTitle}>Voice isolation</span>
            <span className={styles.voiceIsolationHint}>
              Reduce background voices and noise
            </span>
          </span>
          {isVoiceIsolationChanging
            ? <span className={styles.voiceIsolationStatus}>Updating...</span>
            : null}
        </label>

        <div className={styles.micTest}>
          <button
            type="button"
            className={styles.testButton}
            onClick={handleTestMicrophone}
            disabled={
              availableMicrophones.length === 0 || micTestState === "testing"
            }
          >
            {micTestState === "testing" ? "Testing..." : "Test mic"}
          </button>
          <p className={styles.micTestStatus} aria-live="polite">
            {micTestStatus}
          </p>
          <div className={styles.micMeter} aria-hidden>
            <span
              className={styles.micMeterBar}
              style={{
                transform: `scaleX(${Math.max(0.04, micTestLevel)})`,
              }}
            />
          </div>
        </div>
      </div>

      <div className={styles.deviceField}>
        <label className={styles.deviceLabel} htmlFor="speaker-device">
          Audio output
        </label>
        {availableSpeakers.length === 0
          ? <p className={styles.emptyDevices}>Default system output</p>
          : <CustomSelect
              id="speaker-device"
              label="Audio output"
              value={selectedSpeaker}
              options={availableSpeakers.map((spk) => ({
                value: spk.deviceId,
                label: spk.label || "Speaker",
              }))}
              onChange={onSpeakerChange}
            />}
      </div>

      <div className={styles.deviceField}>
        <label className={styles.deviceLabel} htmlFor="camera-device">
          Camera
        </label>
        {availableCameras.length === 0
          ? <p className={styles.emptyDevices}>No cameras detected</p>
          : <CustomSelect
              id="camera-device"
              label="Camera"
              value={selectedCamera}
              options={availableCameras.map((cam) => ({
                value: cam.deviceId,
                label: cam.label || "Camera",
              }))}
              onChange={onCameraChange}
            />}
      </div>
    </section>
  );
}
