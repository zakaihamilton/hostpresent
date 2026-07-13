import { ChatPanel } from "@/components/meeting/ChatPanel";
import { ParticipantsSidebar } from "@/components/meeting/ParticipantsSidebar";
import { PipView } from "@/components/meeting/PipView";
import { PrimaryView } from "@/components/meeting/PrimaryView";
import { RecordingDownloadBanner } from "@/components/meeting/Recording";
import { VideoGallery } from "@/components/meeting/VideoGallery";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import styles from "../MeetingView.module.css";
import { SavedRecordingBanner } from "./SavedRecordingBanner";

export function MeetingWorkspace({
  chatPanelProps,
  downloadState,
  errorMessage,
  galleryProps,
  isChatVisible,
  isMobile,
  isPipVisible,
  isSidebarVisible,
  localStream,
  onCloseChat,
  onClosePanels,
  onCloseSidebar,
  onDismissDownload,
  onDismissError,
  onShowDiagnostics,
  participantSidebarProps,
  pipProps,
  primaryViewProps,
  recording,
  savedRecording,
  videoParticipants,
}) {
  const participantSidebar = (
    <ParticipantsSidebar
      {...participantSidebarProps}
      visible={isSidebarVisible}
      onClose={onCloseSidebar}
    />
  );
  const chatPanel = (
    <ChatPanel
      {...chatPanelProps}
      visible={isChatVisible}
      onClose={onCloseChat}
    />
  );

  return (
    <main className={styles.workspace}>
      {isSidebarVisible || isChatVisible ? (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-label="Close panels"
          onClick={onClosePanels}
        />
      ) : null}

      <div className={styles.stage}>
        <ErrorBanner message={errorMessage} onDismiss={onDismissError} />
        <RecordingDownloadBanner
          downloadState={downloadState}
          onDismiss={onDismissDownload}
        />
        {savedRecording ? <SavedRecordingBanner {...recording} /> : null}

        <div className={styles.gallerySlot}>
          <VideoGallery {...galleryProps} participants={videoParticipants} />
        </div>

        <div className={styles.videoStage}>
          <PrimaryView
            {...primaryViewProps}
            onShowDiagnostics={onShowDiagnostics}
          />
        </div>

        {isPipVisible && localStream ? <PipView {...pipProps} /> : null}
      </div>

      {isSidebarVisible && isChatVisible && !isMobile ? (
        <div className={styles.combinedSlot}>
          <aside className={styles.combinedSidebar}>
            <div className={styles.combinedSection}>
              <ParticipantsSidebar
                {...participantSidebarProps}
                visible
                flex
                onClose={onCloseSidebar}
              />
            </div>
            <div className={styles.combinedDivider} />
            <div className={styles.combinedSection}>
              <ChatPanel
                {...chatPanelProps}
                visible
                flex
                onClose={onCloseChat}
              />
            </div>
          </aside>
        </div>
      ) : (
        <>
          {!isMobile || isSidebarVisible ? participantSidebar : null}
          {!isMobile || isChatVisible ? chatPanel : null}
        </>
      )}
    </main>
  );
}
