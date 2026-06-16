import {
  PARTICIPANT_MODE,
  participantModeLabel,
} from "@/lib/settings/displayNameSettings";
import styles from "./ParticipantModeToggle.module.css";

export function ParticipantModeToggle({ value, onChange, compact = false }) {
  return (
    <fieldset
      className={`${styles.group} ${compact ? styles.groupCompact : ""}`}
    >
      <legend className={styles.legend}>Participation mode</legend>
      <button
        type="button"
        className={`${styles.option} ${value === PARTICIPANT_MODE.AVAILABLE ? styles.optionActive : ""}`}
        aria-pressed={value === PARTICIPANT_MODE.AVAILABLE}
        onClick={() => onChange(PARTICIPANT_MODE.AVAILABLE)}
      >
        {participantModeLabel(PARTICIPANT_MODE.AVAILABLE)}
      </button>
      <button
        type="button"
        className={`${styles.option} ${value === PARTICIPANT_MODE.LISTENING ? styles.optionActive : ""}`}
        aria-pressed={value === PARTICIPANT_MODE.LISTENING}
        onClick={() => onChange(PARTICIPANT_MODE.LISTENING)}
      >
        {participantModeLabel(PARTICIPANT_MODE.LISTENING)}
      </button>
    </fieldset>
  );
}
