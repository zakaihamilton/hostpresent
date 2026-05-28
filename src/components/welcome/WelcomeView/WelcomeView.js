"use client";

import { GitHub, LinkedIn, Logo } from "@/components/ui/Icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Tooltip } from "@/components/ui/Tooltip";
import { APP_ROLE, APP_VIEW } from "@/hooks/hashRouter";
import { SecurityNotice } from "./SecurityNotice";
import { WelcomeHostPanel } from "./WelcomeHostPanel";
import { WelcomeParticipantPanel } from "./WelcomeParticipantPanel";
import styles from "./WelcomeView.module.css";

const AUTHOR_GITHUB_URL = "https://github.com/zakaihamilton/hostpresent";
const AUTHOR_LINKEDIN_URL = "https://www.linkedin.com/in/zakai-hamilton";

export function WelcomeView({
  role,
  token,
  joinCode,
  autoJoinFromRoute = false,
  navigate,
  navigateJoinCode,
  navigateParticipantWelcome,
}) {
  const switchTab = (nextRole) => {
    navigate({
      view: APP_VIEW.WELCOME,
      role: nextRole,
      token: null,
      joinCode: null,
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.glow1} aria-hidden="true" />
      <div className={styles.glow2} aria-hidden="true" />
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.titleRow}>
              <Logo size={32} />
              <h1 className={styles.title}>Host Present</h1>
            </div>
            <ThemeToggle className={styles.themeToggle} />
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
            aria-selected={role === APP_ROLE.HOST}
            className={`${styles.tab} ${role === APP_ROLE.HOST ? styles.tabActive : ""}`}
            onClick={() => switchTab(APP_ROLE.HOST)}
          >
            Host
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === APP_ROLE.PARTICIPANT}
            className={`${styles.tab} ${role === APP_ROLE.PARTICIPANT ? styles.tabActive : ""}`}
            onClick={() => switchTab(APP_ROLE.PARTICIPANT)}
          >
            Participant
          </button>
        </div>

        <div className={styles.panel} key={role}>
          {role === APP_ROLE.HOST
            ? <WelcomeHostPanel legacyToken={token} navigate={navigate} />
            : <WelcomeParticipantPanel
                token={token}
                joinCode={joinCode}
                autoJoinFromRoute={autoJoinFromRoute}
                navigate={navigate}
                navigateJoinCode={navigateJoinCode}
                navigateParticipantWelcome={navigateParticipantWelcome}
              />}
        </div>

        <footer className={styles.footer}>
          <span className={styles.footerText}>Zakai Hamilton</span>
          <Tooltip text="GitHub Repository" placement="top">
            <a
              href={AUTHOR_GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.githubLink}
              aria-label="GitHub Repository"
            >
              <GitHub size={18} />
            </a>
          </Tooltip>
          <Tooltip text="LinkedIn Profile" placement="top">
            <a
              href={AUTHOR_LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkedinLink}
              aria-label="LinkedIn Profile"
            >
              <LinkedIn size={18} />
            </a>
          </Tooltip>
        </footer>
      </div>
    </div>
  );
}
