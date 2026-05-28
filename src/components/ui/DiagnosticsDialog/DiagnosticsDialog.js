import { useEffect, useState, useId } from "react";
import { fetchPeerJsConfig } from "@/lib/webrtc/signalingConfig";
import styles from "./DiagnosticsDialog.module.css";

export function DiagnosticsDialog({ open, onClose }) {
  const titleId = useId();
  const [running, setRunning] = useState(false);
  const [tests, setTests] = useState({
    browser: { name: "Browser Compatibility", status: "idle", details: "" },
    api: { name: "App API Resolution", status: "idle", details: "" },
    signaling: {
      name: "Signaling Server Reachability",
      status: "idle",
      details: "",
    },
    stun: { name: "WebRTC STUN Connectivity", status: "idle", details: "" },
  });

  const runDiagnostics = async () => {
    setRunning(true);
    setTests({
      browser: {
        name: "Browser Compatibility",
        status: "running",
        details: "Checking WebRTC and WebSockets...",
      },
      api: { name: "App API Resolution", status: "idle", details: "" },
      signaling: {
        name: "Signaling Server Reachability",
        status: "idle",
        details: "",
      },
      stun: { name: "WebRTC STUN Connectivity", status: "idle", details: "" },
    });

    // 1. Browser Test
    const hasWS = typeof window !== "undefined" && !!window.WebSocket;
    const hasWebRTC =
      typeof window !== "undefined" && !!window.RTCPeerConnection;
    let browserStatus = "pass";
    let browserDetails = "WebRTC & WebSockets supported.";
    if (!hasWS || !hasWebRTC) {
      browserStatus = "fail";
      browserDetails = `Unsupported: ${!hasWS ? "WebSocket missing. " : ""}${!hasWebRTC ? "WebRTC missing." : ""}`;
    }

    setTests((prev) => ({
      ...prev,
      browser: {
        ...prev.browser,
        status: browserStatus,
        details: browserDetails,
      },
      api: {
        ...prev.api,
        status: "running",
        details: "Fetching server signaling configuration...",
      },
    }));

    await new Promise((r) => setTimeout(r, 600));

    // 2. API Test
    let config = null;
    let apiStatus = "pass";
    let apiDetails = "Signaling config fetched successfully.";
    try {
      config = await fetchPeerJsConfig();
      if (!config) {
        apiStatus = "warning";
        apiDetails =
          "Signaling not configured on server (SIGNALING_SERVER_URL is missing).";
      }
    } catch (err) {
      apiStatus = "fail";
      apiDetails = `Failed to fetch API config: ${err.message}`;
    }

    setTests((prev) => ({
      ...prev,
      api: { ...prev.api, status: apiStatus, details: apiDetails },
      signaling: {
        ...prev.signaling,
        status: config ? "running" : "idle",
        details: config ? `Pinging signaling host: ${config.host}...` : "N/A",
      },
    }));

    if (!config) {
      setRunning(false);
      return;
    }

    await new Promise((r) => setTimeout(r, 800));

    // 3. Signaling Reachability Test
    let sigStatus = "pass";
    let sigDetails = `Signaling server reached successfully at: ${config.host}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const url = `https://${config.host}:${config.port}${config.path}`;
      const res = await fetch(url, {
        mode: "no-cors",
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (err) {
      sigStatus = "fail";
      sigDetails = `Could not connect to signaling host ${config.host}. Please confirm the server is running and allowed by your firewall/VPN.`;
    }

    setTests((prev) => ({
      ...prev,
      signaling: { ...prev.signaling, status: sigStatus, details: sigDetails },
      stun: {
        ...prev.stun,
        status: sigStatus === "pass" ? "running" : "idle",
        details:
          sigStatus === "pass" ? "Gathering WebRTC ICE candidates..." : "N/A",
      },
    }));

    if (sigStatus !== "pass") {
      setRunning(false);
      return;
    }

    await new Promise((r) => setTimeout(r, 1000));

    // 4. ICE/STUN Connection Test
    let stunStatus = "pass";
    let stunDetails = "STUN servers resolved candidates successfully.";
    try {
      const pc = new RTCPeerConnection(
        config.config || {
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        },
      );
      pc.createDataChannel("test-channel");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const icePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve("timeout");
        }, 5000);

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            clearTimeout(timeout);
            resolve("success");
          }
        };
      });

      const result = await icePromise;
      pc.close();

      if (result === "timeout") {
        stunStatus = "warning";
        stunDetails =
          "STUN candidate gathering timed out. Relayed TURN servers or firewalls/VPN disabling is likely required to connect with remote participants.";
      }
    } catch (err) {
      stunStatus = "fail";
      stunDetails = `WebRTC engine failed: ${err.message}`;
    }

    setTests((prev) => ({
      ...prev,
      stun: { ...prev.stun, status: stunStatus, details: stunDetails },
    }));
    setRunning(false);
  };

  useEffect(() => {
    if (open) {
      runDiagnostics();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className={styles.title}>
          Connection Diagnostics
        </h2>
        <p className={styles.intro}>
          Run diagnostics to identify signaling, WebRTC, network traversal, or
          VPN connection blockages.
        </p>

        <div className={styles.testList}>
          {Object.entries(tests).map(([key, test]) => (
            <div
              key={key}
              className={`${styles.testCard} ${styles[test.status]}`}
            >
              <div className={styles.testHeader}>
                <span className={styles.testName}>{test.name}</span>
                <span
                  className={`${styles.badge} ${styles[`badge-${test.status}`]}`}
                >
                  {test.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={runDiagnostics}
            disabled={running}
          >
            {running ? "Running..." : "Re-run Tests"}
          </button>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
