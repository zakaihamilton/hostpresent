import type { ComponentProps } from "react";
import { MeetingControls } from "./components/MeetingControls";
import { MeetingHeaderArea } from "./components/MeetingHeaderArea";
import { MeetingWorkspace } from "./components/MeetingWorkspace";
import styles from "./MeetingView.module.css";

interface MeetingViewScreenProps {
  headerProps: ComponentProps<typeof MeetingHeaderArea>;
  workspaceProps: ComponentProps<typeof MeetingWorkspace>;
  controlsProps: ComponentProps<typeof MeetingControls>;
}

/** Renders the meeting surface; state, effects, and event handlers stay with the controller. */
export function MeetingViewScreen({
  headerProps,
  workspaceProps,
  controlsProps,
}: MeetingViewScreenProps) {
  return (
    <div className={styles.app}>
      <MeetingHeaderArea {...headerProps} />
      <MeetingWorkspace {...workspaceProps} />
      <MeetingControls {...controlsProps} />
    </div>
  );
}
