"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Icons";
import { APP_ROLE, APP_VIEW } from "@/hooks/hashRouter";
import { SecurityNotice } from "./SecurityNotice";
import { WelcomeHostPanel } from "./WelcomeHostPanel";
import { WelcomeParticipantPanel } from "./WelcomeParticipantPanel";
import styles from "./WelcomeView.module.css";

export function WelcomeView({
  role,
  token,
  joinCode,
  openProof,
  navigate,
  navigateJoinCode,
  navigateParticipantWelcome,
}) {
  const [activeTab, setActiveTab] = useState(role);

  useEffect(() => {
    setActiveTab(role);
  }, [role]);

  const switchTab = (nextRole) => {
    setActiveTab(nextRole);
    navigate({
      view: APP_VIEW.WELCOME,
      role: nextRole,
      joinCode: nextRole === APP_ROLE.HOST ? joinCode : null,
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <Logo size={32} />
            <h1 className={styles.title}>Host Present</h1>
          </div>
          <p className={styles.subtitle}>
            Start a meeting as host or join as a participant.
          </p>
        </div>

        <SecurityNotice />

        <div className={styles.tabs} role="tablist" aria-label="Welcome mode">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === APP_ROLE.HOST}
            className={`${styles.tab} ${activeTab === APP_ROLE.HOST ? styles.tabActive : ""}`}
            onClick={() => switchTab(APP_ROLE.HOST)}
          >
            Host
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === APP_ROLE.PARTICIPANT}
            className={`${styles.tab} ${activeTab === APP_ROLE.PARTICIPANT ? styles.tabActive : ""}`}
            onClick={() => switchTab(APP_ROLE.PARTICIPANT)}
          >
            Participant
          </button>
        </div>

        <div className={styles.panel}>
          {activeTab === APP_ROLE.HOST
            ? <WelcomeHostPanel
                joinCode={joinCode}
                legacyToken={token}
                navigate={navigate}
              />
            : <WelcomeParticipantPanel
                token={token}
                joinCode={joinCode}
                openProof={openProof}
                navigate={navigate}
                navigateJoinCode={navigateJoinCode}
                navigateParticipantWelcome={navigateParticipantWelcome}
              />}
        </div>
      </div>
    </div>
  );
}
