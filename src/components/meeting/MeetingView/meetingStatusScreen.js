import { MeetingJoinError } from "@/components/ui/MeetingJoinError";
import { MeetingLoading } from "@/components/ui/MeetingLoading";
import { ROOM_SESSION_STATUS } from "@/hooks/roomSession";
import {
  getSignalingConfigHint,
  getSignalingErrorHint,
} from "@/lib/webrtc/peerClient";

export function getMeetingStatusScreen({
  sessionStatus,
  sessionError,
  handleBack,
  handleDisconnectBack,
  signalingConfigError,
  meetingDisconnectReason,
  fatalConnectionError,
  isHost,
}) {
  if (sessionStatus === ROOM_SESSION_STATUS.LOADING) {
    return <MeetingLoading message="Loading room…" />;
  }

  if (sessionStatus === ROOM_SESSION_STATUS.ERROR) {
    return (
      <MeetingJoinError
        title="Could not join meeting"
        message={sessionError || "Failed to load room session."}
        onBack={handleBack}
      />
    );
  }

  if (signalingConfigError) {
    return (
      <MeetingJoinError
        title="Signaling not configured"
        message={signalingConfigError}
        hint={getSignalingConfigHint()}
        onBack={handleBack}
      />
    );
  }

  if (meetingDisconnectReason === "limit_reached") {
    return (
      <MeetingJoinError
        title="Meeting limit reached"
        message="This meeting has reached the 6-hour limit."
        onBack={handleDisconnectBack}
      />
    );
  }

  if (meetingDisconnectReason === "ended") {
    return (
      <MeetingJoinError
        title="Meeting ended"
        message="The host has ended this meeting."
        onBack={handleDisconnectBack}
      />
    );
  }

  if (meetingDisconnectReason === "full") {
    return (
      <MeetingJoinError
        title="Meeting is full"
        message="This meeting has reached the maximum capacity of 30 participants."
        onBack={handleDisconnectBack}
      />
    );
  }

  if (fatalConnectionError) {
    return (
      <MeetingJoinError
        title="Could not connect to meeting"
        message={fatalConnectionError}
        hint={getSignalingErrorHint(fatalConnectionError, { isHost })}
        onBack={handleBack}
      />
    );
  }

  return null;
}
