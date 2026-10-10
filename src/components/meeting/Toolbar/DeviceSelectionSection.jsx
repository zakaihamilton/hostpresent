import styles from "./MediaControls.module.css";

export function DeviceSelectionSection({
  id,
  title,
  legend,
  name,
  devices,
  selectedDevice,
  onChange,
  fallbackLabel,
  unavailableLabel,
  emptyMessage,
  children,
}) {
  return (
    <section className={styles.menuSection} aria-labelledby={id}>
      <div className={styles.menuSectionHeader}>
        <h3 id={id} className={styles.menuSectionTitle}>
          {title}
        </h3>
        <span className={styles.menuSectionMeta}>
          {devices.length > 0
            ? `${devices.length} available`
            : unavailableLabel}
        </span>
      </div>
      {devices.length === 0 ? (
        <p className={styles.menuEmpty}>{emptyMessage}</p>
      ) : (
        <fieldset className={styles.menuFieldset}>
          <legend className={styles.menuLegend}>{legend}</legend>
          {devices.map((device, index) => (
            <label
              key={device.deviceId}
              htmlFor={`device-${device.deviceId}`}
              className={`${styles.menuOption} ${selectedDevice === device.deviceId ? styles.menuOptionSelected : ""}`}
            >
              <input
                id={`device-${device.deviceId}`}
                aria-label={device.label || `${fallbackLabel} ${index + 1}`}
                type="radio"
                name={name}
                checked={selectedDevice === device.deviceId}
                onChange={() => onChange?.(device.deviceId)}
                className={styles.menuOptionInput}
              />
              <span className={styles.menuOptionContent}>
                <span className={styles.menuOptionTitle}>
                  {device.label || `${fallbackLabel} ${index + 1}`}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {children}
    </section>
  );
}
