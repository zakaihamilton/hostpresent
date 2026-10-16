"use client";

import { type ReactNode, useEffect, useState } from "react";
import { fetchIceServers } from "@/lib/webrtc/signalingConfig";
import { IceConfigProvider } from "./IceConfigContext";
import styles from "./PeerStreamConnection.module.css";

export function PeerStreamConnection({
  children,
  onError,
  peerAuthToken,
  iceConfigUrl,
  sessionError,
}: {
  children?: ReactNode;
  onError?: (error: Error) => void;
  peerAuthToken?: string;
  iceConfigUrl?: string;
  sessionError?: string | null;
}) {
  const [iceServers, setIceServers] = useState<RTCIceServer[] | null>(null);
  const [configError, setConfigError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!peerAuthToken || !iceConfigUrl) return undefined;

    void fetchIceServers(peerAuthToken, iceConfigUrl)
      .then((servers) => {
        if (cancelled) return;
        setIceServers(servers);
      })
      .catch((error) => {
        if (cancelled) return;
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        setConfigError(normalizedError);
        onError?.(normalizedError);
      });

    return () => {
      cancelled = true;
    };
  }, [iceConfigUrl, onError, peerAuthToken]);

  if (sessionError) {
    return (
      <div className={styles.root} role="alert">
        <p className={styles.error}>{sessionError}</p>
      </div>
    );
  }

  if (configError) {
    return (
      <div className={styles.root} role="alert">
        <p className={styles.error}>
          {configError.message ?? "Could not secure streaming paths."}
        </p>
      </div>
    );
  }

  if (!iceServers) {
    return (
      <div className={styles.root} aria-live="polite">
        <div className={styles.loading}>
          <div className={styles.spinner} aria-hidden />
          <p className={styles.message}>Securing streaming paths...</p>
        </div>
      </div>
    );
  }

  return (
    <IceConfigProvider iceServers={iceServers}>
      <div className={styles.content}>{children}</div>
    </IceConfigProvider>
  );
}
