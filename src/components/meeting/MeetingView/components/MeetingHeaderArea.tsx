import { ConnectionBanner } from "@/components/meeting/ConnectionBanner/ConnectionBanner";
import { Header } from "@/components/meeting/Header";
import { InviteBar } from "@/components/meeting/InviteBar/InviteBar";
import styles from "../MeetingView.module.css";

export function MeetingHeaderArea({
  isRecording,
  isRecordingPaused,
  headerProps,
  connectionProps,
  inviteProps,
}: {
  isRecording?: any;
  isRecordingPaused?: any;
  headerProps?: any;
  connectionProps?: any;
  inviteProps?: any;
}) {
  const { visible: showInviteBar, ...inviteBarProps } = inviteProps;

  return (
    <>
      {isRecording && (
        <div
          className={`${styles.recordingBar} ${isRecordingPaused ? styles.recordingBarPaused : ""}`}
          aria-hidden
        />
      )}
      <Header {...headerProps} />
      <ConnectionBanner {...connectionProps} />
      {showInviteBar ? <InviteBar {...inviteBarProps} /> : null}
    </>
  );
}
