"use client";

import { useEffect, useState } from "react";
import styles from "./SecurityNotice.module.css";

export function SecurityNotice() {
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/rooms/config", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;

        if (!data.signalingServerConfigured) {
          setNotice({
            title: "[E080] Signaling not configured.",
            message:
              "WebRTC will not work until SIGNALING_SERVER_URL is set on the server (Vercel env vars or .env.local).",
          });
          return;
        }

        if (!data.encrypted) {
          setNotice({
            title: "[E081] Not encrypted.",
            message:
              "Room links are working, but tokens use a default secret. Set SIGNALING_SERVER_URL for production room signing.",
          });
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

  if (!notice) {
    return null;
  }

  return (
    <div className={styles.notice} role="status">
      <strong>{notice.title}</strong> {notice.message}
    </div>
  );
}
