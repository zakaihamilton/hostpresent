import styles from "./Tooltip.module.css";

const PLACEMENT_CLASS = {
  top: styles.textTop,
  left: styles.textLeft,
};

export function Tooltip({ children, text, placement = "top" }) {
  return (
    <div className={styles.wrapper}>
      {children}
      <span className={`${styles.text} ${PLACEMENT_CLASS[placement] ?? PLACEMENT_CLASS.top}`}>
        {text}
      </span>
    </div>
  );
}
