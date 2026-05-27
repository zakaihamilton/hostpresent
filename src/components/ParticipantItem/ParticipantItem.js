import styles from "./ParticipantItem.module.css";

export function ParticipantItem({
  name,
  initial,
  avatarColor,
  avatarFontSize,
  statusIcons,
}) {
  return (
    <div className={styles.item}>
      <div className={styles.info}>
        <div
          className={styles.avatar}
          style={{
            background: avatarColor,
            fontSize: avatarFontSize,
          }}
        >
          {initial}
        </div>
        <div>
          <div className={styles.name}>{name}</div>
        </div>
      </div>
      <div className={styles.status}>{statusIcons}</div>
    </div>
  );
}
