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
      {/* Global Theme Toggle Viewport Header */}
      <header className={styles.globalHeader}>
        <ThemeToggle className={styles.themeToggle} />
      </header>

      <div className={styles.container}>
        {/* Left Column: Clean, Trusted Editorial Showcase & High-Fidelity CSS Preview */}
        <div className={styles.heroColumn}>
          <div className={styles.brandRow}>
            <Logo size={36} className={styles.brandLogo} />
            <span className={styles.brandName}>Host Present</span>
          </div>
          
          <h2 className={styles.heroTitle}>
            Premium video meetings. Designed for professional presenters.
          </h2>
          <p className={styles.heroSubtitle}>
            Conduct reliable browser-based sessions with complete presenter control. Orchestrate participant stream focus and save crystal-clear recordings locally with zero installation.
          </p>
          
          {/* Abstract Skeleton UI Browser Frame */}
          <div className={styles.browserFrame}>
            {/* Browser Header Bar */}
            <div className={styles.browserBar}>
              <div className={styles.browserDots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
              <div className={styles.addressBar} />
            </div>
            
            {/* Browser Content Area */}
            <div className={styles.browserCanvas}>
              {/* Main Presentation Screen Block (Large) */}
              <div className={styles.skeletonMainScreen} />
              
              {/* Sidebar Participant Feeds (Small Blocks) */}
              <div className={styles.skeletonSidebar}>
                <div className={`${styles.skeletonFeed} ${styles.skeletonFeedActive}`} />
                <div className={styles.skeletonFeed} />
              </div>
            </div>
          </div>
          
          <div className={styles.featureList}>
            <div className={styles.featureRow}>
              <span className={styles.bullet} />
              <span><strong>Sub-second latency:</strong> Peer-to-peer WebRTC connections for instant engagement.</span>
            </div>
            <div className={styles.featureRow}>
              <span className={styles.bullet} />
              <span><strong>Local recording:</strong> Capture and save high-fidelity recordings directly in your browser.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Setup Card */}
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.headerTop}>
              <div className={styles.titleRowMobile}>
                <Logo size={28} />
                <h1 className={styles.title}>Host Present</h1>
              </div>
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
            <div
              className={styles.tabPill}
              style={{
                transform: `translateX(${role === APP_ROLE.HOST ? "0%" : "100%"})`
              }}
            />
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

      {/* Global Viewport Footer pinned to the absolute bottom */}
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
