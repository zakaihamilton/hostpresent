import { ArrowLeft } from "@/components/Icons";
import { Tooltip } from "@/components/Tooltip";
import styles from "./BackButton.module.css";

export function BackButton({ label = "Back", onClick, className = "" }) {
  return (
    <Tooltip text={label} placement="left">
      <button
        type="button"
        className={`${styles.button} ${className}`.trim()}
        onClick={onClick}
        aria-label={label}
      >
        <ArrowLeft size={20} />
      </button>
    </Tooltip>
  );
}
