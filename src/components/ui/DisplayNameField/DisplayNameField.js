import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/settings/displayNameSettings";
import styles from "./DisplayNameField.module.css";

export function DisplayNameField({
  id,
  label = "Your name",
  value,
  onChange,
  placeholder = "Enter your name",
  compact = false,
  className = "",
}) {
  return (
    <div
      className={`${styles.field} ${compact ? styles.fieldCompact : ""} ${className}`}
    >
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={MAX_DISPLAY_NAME_LENGTH}
        autoComplete="name"
        spellCheck={false}
      />
    </div>
  );
}
