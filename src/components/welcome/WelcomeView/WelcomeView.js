"use client";

import Image from "next/image";
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
      {/* Global Theme Toggle Viewport Header */}
      <header className={styles.globalHeader}>
        <ThemeToggle className={styles.themeToggle} />
      </header>

      <div className={styles.container}>
        <div className={styles.brandRowHeader}>
          <Logo size={44} className={styles.brandLogo} />
          <h1 className={styles.brandName}>Host Present</h1>
          <p className={styles.brandSubtitle}>
            Presenter-led sessions with controlled participant focus and local
            recording
          </p>
        </div>

        {/* Setup Card: Now the main visual anchor */}
        <div className={styles.card}>
          <SecurityNotice />

          <div className={styles.tabs} role="tablist" aria-label="Welcome mode">
            <button
              type="button"
              role="tab"
              aria-selected={role === APP_ROLE.HOST}
              aria-label="Host"
              className={`${styles.tab} ${role === APP_ROLE.HOST ? styles.tabActive : ""}`}
              onClick={() => switchTab(APP_ROLE.HOST)}
            >
              <span className={styles.tabHeading}>Host a Session</span>
              <span className={styles.tabSubheading}>
                Create a room and record locally
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === APP_ROLE.PARTICIPANT}
              aria-label="Participant"
              className={`${styles.tab} ${role === APP_ROLE.PARTICIPANT ? styles.tabActive : ""}`}
              onClick={() => switchTab(APP_ROLE.PARTICIPANT)}
            >
              <span className={styles.tabHeading}>Join a Session</span>
              <span className={styles.tabSubheading}>
                Enter code to participate
              </span>
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
        </div>
      </div>

      {/* Global Viewport Footer */}
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
            <GitHub size={16} />
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
            <LinkedIn size={16} />
          </a>
        </Tooltip>
      </footer>
    </div>
  );
}
