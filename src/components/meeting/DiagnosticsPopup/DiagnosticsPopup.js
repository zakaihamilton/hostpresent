"use client";

import { memo } from "react";
import { Refresh, X } from "@/components/ui/Icons";
import { Tooltip } from "@/components/ui/Tooltip";
import styles from "./DiagnosticsPopup.module.css";

export const DiagnosticsPopup = memo(function DiagnosticsPopup({
  isOpen,
  onClose,
  role,
  roomId,
  connectionStatus,
  localParticipantId,
  peerConfig,
  iceServers,
  activeConnectionsCount,
  connectionError,
  onReconnect,
  isTurnActive = false,
}) {
  if (!isOpen) return null;

  const isHost = role === "host";
  const statusLabel = connectionStatus || "unknown";

  // Check if TURN is configured in ICE servers
  const hasTurnServer = Boolean(
    iceServers?.some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some(
        (url) => url?.startsWith("turn:") || url?.startsWith("turns:"),
      );
    }),
  );

  const isLocalSignaling =
    peerConfig?.host === "localhost" || peerConfig?.host === "127.0.0.1";

  // Determine current active media routing
  let mediaRoutingLabel = "Idle (No active streams)";
  let mediaRoutingClass = styles.routeIdle;
  if (activeConnectionsCount > 0) {
    if (isTurnActive) {
      mediaRoutingLabel =
        "Relayed through TURN (Bypassing firewall/symmetric NAT)";
      mediaRoutingClass = styles.routeRelayed;
    } else {
      mediaRoutingLabel = "Direct Peer-to-Peer (Optimal high-speed connection)";
      mediaRoutingClass = styles.routeDirect;
    }
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div
        className={styles.popup}
        role="dialog"
        aria-modal="true"
        aria-labelledby="diagnostics-title"
      >
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <span
              className={`${styles.statusDot} ${styles[`statusDot_${statusLabel}`]}`}
            />
            <h2 id="diagnostics-title" className={styles.title}>
              Connection Diagnostics
            </h2>
          </div>
          <Tooltip text="Close" placement="bottom">
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close diagnostics dialog"
            >
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        <div className={styles.content}>
          {/* Status Alert/Summary */}
          <div
            className={`${styles.statusBanner} ${styles[`statusBanner_${statusLabel}`]}`}
          >
            <div className={styles.statusBannerTitle}>
              Overall Status: {statusLabel.toUpperCase()}
            </div>
            {connectionError
              ? <div className={styles.statusBannerError}>
                  {connectionError}
                </div>
              : <div className={styles.statusBannerDesc}>
                  {statusLabel === "connected"
                    ? "Connected to signaling and active media session."
                    : statusLabel === "connecting"
                      ? "Attempting connection to the signaling server..."
                      : "Not connected to the meeting session."}
                </div>}
          </div>

          {/* Session Info Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Session Information</h3>
            <div className={styles.grid}>
              <div className={styles.gridItem}>
                <span className={styles.gridLabel}>Role</span>
                <span className={styles.gridValue}>
                  {isHost ? "Host (Presenter)" : "Participant (Guest)"}
                </span>
              </div>
              <div className={styles.gridItem}>
                <span className={styles.gridLabel}>Room ID / Code</span>
                <span className={styles.gridValue}>{roomId || "N/A"}</span>
              </div>
              <div className={styles.gridItem}>
                <span className={styles.gridLabel}>My Anonymous ID</span>
                <span className={`${styles.gridValue} ${styles.mono}`}>
                  {localParticipantId || "Generating..."}
                </span>
              </div>
              <div className={styles.gridItem}>
                <span className={styles.gridLabel}>Active Peer Links</span>
                <span className={styles.gridValue}>
                  {isHost
                    ? `${activeConnectionsCount} participant(s) linked`
                    : activeConnectionsCount > 0
                      ? "Connected to Host"
                      : "Host disconnected"}
                </span>
              </div>
            </div>
          </div>

          {/* Signaling Connection Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Signaling Server Status</h3>
            <div className={styles.grid}>
              <div className={styles.gridItem}>
                <span className={styles.gridLabel}>Connection Status</span>
                <span
                  className={`${styles.gridValue} ${
                    statusLabel === "connected"
                      ? styles.textSuccess
                      : statusLabel === "connecting"
                        ? styles.textWarning
                        : styles.textDanger
                  }`}
                >
                  {statusLabel === "connected"
                    ? "Active & Connected"
                    : statusLabel === "connecting"
                      ? "Connecting..."
                      : "Offline / Disconnected"}
                </span>
              </div>
              <div className={styles.gridItem}>
                <span className={styles.gridLabel}>Server Cluster Node</span>
                <span className={styles.gridValue}>
                  {isLocalSignaling
                    ? "Local Development Server"
                    : "Cloud Router Cluster"}
                </span>
              </div>
              <div className={styles.gridItem}>
                <span className={styles.gridLabel}>Security Protocol</span>
                <span className={styles.gridValue}>
                  {peerConfig?.secure
                    ? "Secure TLS (Encrypted)"
                    : "Standard Non-SSL"}
                </span>
              </div>
              <div className={styles.gridItem}>
                <span className={styles.gridLabel}>API Gateway Status</span>
                <span className={styles.gridValue}>
                  {statusLabel === "connected"
                    ? "Operational"
                    : "Degraded / Connecting"}
                </span>
              </div>
            </div>
          </div>

          {/* Media Routing & ICE Section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Media Routing & ICE</h3>
            <div className={styles.grid}>
              <div className={styles.gridItem}>
                <span className={styles.gridLabel}>
                  STUN Server (Direct P2P)
                </span>
                <span className={`${styles.gridValue} ${styles.textSuccess}`}>
                  Active & Available
                </span>
              </div>
              <div className={styles.gridItem}>
                <span className={styles.gridLabel}>TURN Relay Server</span>
                <span
                  className={`${styles.gridValue} ${
                    hasTurnServer ? styles.textSuccess : styles.textMuted
                  }`}
                >
                  {hasTurnServer ? "Configured & Available" : "Not Configured"}
                </span>
              </div>
              <div className={`${styles.gridItem} ${styles.fullWidth}`}>
                <span className={styles.gridLabel}>
                  Current Network Routing
                </span>
                <span className={`${styles.gridValue} ${mediaRoutingClass}`}>
                  {mediaRoutingLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.reconnectButton}
            onClick={onReconnect}
            aria-label="Retry connection"
          >
            <Refresh size={14} />
            <span>Reconnect / Force Retry</span>
          </button>
          <button
            type="button"
            className={styles.closeAction}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
});
