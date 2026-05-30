import { ArrowLeft } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import styles from "./BackButton.module.css";

export function BackButton({ label = "Back", onClick, className = "" }) {
  return (
    <Tooltip text={label} placement="bottom">
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
