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

        if (!data.roomSigningConfigured) {
          setNotice({
            title: "[E081] Room signing is not configured.",
            message:
              "Room creation, code resolution, and saved room access are unavailable until ROOM_TOKEN_SECRET is set on the server.",
          });
          return;
        }

        if (!data.signalingServerConfigured) {
          setNotice({
            title: "[E080] Signaling not configured.",
            message:
              "WebRTC will not work until Peerovo is reachable and its project settings are configured on the server.",
          });
          return;
        }

        if (data.signalingAuthMode !== "project-session-peerovo-v1") {
          setNotice({
            title: "[E084] Authenticated signaling is not configured.",
            message:
              "WebRTC requires Peerovo project, session, and peer authentication.",
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
    <output className={styles.notice}>
      <strong>{notice.title}</strong> {notice.message}
    </output>
  );
}
