"use client";

import { useEffect, useState } from "react";
import styles from "./SecurityNotice.module.css";

export function SecurityNotice() {
  const [encrypted, setEncrypted] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/rooms/config");
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setEncrypted(Boolean(data.encrypted));
        }
      } catch {
        // leave banner hidden if config cannot be loaded
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (encrypted !== false) {
    return null;
  }

  return (
    <div className={styles.notice} role="status">
      <strong>Not encrypted.</strong> Room links are working, but tokens are
      signed with a default secret. Set <code>NEXT_PUBLIC_SIGNALING_SERVER_URL</code>{" "}
      for encrypted room access in production.
    </div>
  );
}
