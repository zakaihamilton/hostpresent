import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetingView } from "./MeetingView";

jest.mock("@/components/Header", () => ({
  Header: ({ onBack, backLabel = "Back" }) => (
    <button type="button" onClick={onBack}>
      {backLabel}
    </button>
  ),
}));

jest.mock("@/components/PrimaryView", () => ({
  PrimaryView: ({ label }) => <div data-testid="primary-view">{label}</div>,
}));

jest.mock("@/components/Toolbar", () => ({
  Toolbar: ({ onToggleAudio, onToggleSidebar }) => (
    <div>
      <button type="button" onClick={onToggleAudio}>
        Toggle audio
      </button>
      <button type="button" onClick={onToggleSidebar}>
        Toggle sidebar
      </button>
    </div>
  ),
}));

jest.mock("@/components/ParticipantsSidebar", () => ({
  ParticipantsSidebar: ({ visible }) =>
    visible ? <div data-testid="sidebar">Sidebar</div> : null,
}));

jest.mock("@/components/VideoGallery", () => ({
  VideoGallery: () => null,
}));

jest.mock("@/components/ErrorBanner", () => ({
  ErrorBanner: () => null,
}));

jest.mock("@/components/RecordingDownloadBanner", () => ({
  RecordingDownloadBanner: () => null,
}));

jest.mock("@/components/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

jest.mock("@/hooks/roomSession", () => ({
  ROOM_SESSION_STATUS: {
    IDLE: "idle",
    LOADING: "loading",
    WAITING: "waiting",
    OPEN: "open",
    ERROR: "error",
  },
  useRoomSession: () => ({
    status: "open",
    roomState: { roomId: "room-1", joinCode: "ABCDEFGH" },
    error: "",
  }),
}));

jest.mock("@/lib/webrtc/peerClient", () => ({
  getSignalingConfigHint: () => null,
  isFatalSignalingError: () => false,
  isWaitingForHostMessage: () => false,
}));

jest.mock("@/hooks", () => ({
  useConfirmDialog: () => ({
    confirm: jest.fn(),
    dialogProps: {},
  }),
  useHostControls: () => ({
    muteParticipantAudio: jest.fn(),
    muteParticipantVideo: jest.fn(),
    muteAllAudio: jest.fn(),
    muteAllVideo: jest.fn(),
    canMuteAllAudio: false,
    canMuteAllVideo: false,
  }),
  useSessionTimers: () => ({
    meetingSeconds: 0,
    recordingSeconds: 0,
    resetRecordingTimer: jest.fn(),
  }),
  useRoomDataChannel: () => ({
    send: jest.fn(),
    subscribe: jest.fn(() => () => {}),
    hostPresent: true,
    localParticipantId: "participant-1",
    connectionError: null,
    status: "connected",
    isConnected: true,
  }),
}));

describe("MeetingView", () => {
  it("renders host meeting UI", async () => {
    render(
      <MeetingView role="host" token="host-token" onBack={() => {}} />,
    );

    expect(await screen.findByTestId("primary-view")).toHaveTextContent(
      "You (Host)",
    );
  });

  it("calls onBack from header", async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();

    render(
      <MeetingView role="host" token="host-token" onBack={onBack} />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Back to welcome" }),
    );
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
