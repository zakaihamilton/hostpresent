import styles from "./Tooltip.module.css";

export function Tooltip({ children, text }) {
  return (
    <div className={styles.wrapper}>
      {children}
      <span className={styles.text}>{text}</span>
    </div>
  );
}
