import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetingView } from "./MeetingView";

const mockDisconnect = jest.fn();
let latestToolbarProps = null;

beforeAll(() => {
  Object.defineProperty(global.navigator, "mediaDevices", {
    value: {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      enumerateDevices: jest.fn().mockResolvedValue([]),
      getUserMedia: jest.fn().mockResolvedValue({
        getVideoTracks: () => [
          { getSettings: () => ({ deviceId: "" }), stop: jest.fn() },
        ],
        getAudioTracks: () => [],
        getTracks: () => [],
        addTrack: jest.fn(),
        removeTrack: jest.fn(),
      }),
    },
    writable: true,
    configurable: true,
  });
});

jest.mock("@/components/meeting/Header", () => ({
  Header: ({ onBack, backLabel = "Back" }) => (
    <button type="button" onClick={onBack}>
      {backLabel}
    </button>
  ),
}));

jest.mock("@/components/meeting/PrimaryView", () => ({
  PrimaryView: ({ label }) => <div data-testid="primary-view">{label}</div>,
}));

jest.mock("@/components/meeting/Toolbar", () => ({
  Toolbar: (props) => {
    latestToolbarProps = props;
    return (
      <div>
        <button type="button" onClick={props.onToggleAudio}>
          Toggle audio
        </button>
        <button type="button" onClick={props.onToggleSidebar}>
          Toggle sidebar
        </button>
      </div>
    );
  },
}));

jest.mock("@/components/meeting/ParticipantsSidebar", () => ({
  ParticipantsSidebar: ({ visible }) =>
    visible ? <div data-testid="sidebar">Sidebar</div> : null,
}));

jest.mock("@/components/meeting/VideoGallery", () => ({
  VideoGallery: () => null,
}));

jest.mock("@/components/meeting/ConnectionBanner/ConnectionBanner", () => ({
  ConnectionBanner: () => null,
}));

jest.mock("@/components/meeting/InviteBar/InviteBar", () => ({
  InviteBar: () => null,
}));

jest.mock("@/components/ui/ErrorBanner", () => ({
  ErrorBanner: () => null,
}));

jest.mock("@/components/ui/RecordingDownloadBanner", () => ({
  RecordingDownloadBanner: () => null,
}));

jest.mock("@/components/ui/ConfirmDialog", () => ({
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
  hostPeerId: (roomId) => `hp-${roomId}`,
}));

jest.mock("@/components/meeting/ChatPanel", () => ({
  ChatPanel: ({ visible }) =>
    visible ? <div data-testid="chat-panel">Chat</div> : null,
}));

jest.mock("@/components/webrtc/PeerStreamConnection", () => ({
  PeerStreamConnection: ({ children }) => children,
  useIceServers: () => [{ urls: "stun:stun.l.google.com:19302" }],
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
    disconnect: mockDisconnect,
    hostPresent: true,
    localParticipantId: "participant-1",
    connectionError: null,
    status: "connected",
    isConnected: true,
  }),
}));

describe("MeetingView", () => {
  beforeEach(() => {
    mockDisconnect.mockClear();
    latestToolbarProps = null;
  });

  it("renders host meeting UI", async () => {
    render(<MeetingView role="host" token="host-token" onBack={() => {}} />);

    expect(await screen.findByTestId("primary-view")).toHaveTextContent(
      "Guest",
    );
  });

  it("disconnects signaling before navigating back", async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();

    render(<MeetingView role="host" token="host-token" onBack={onBack} />);

    await user.click(
      await screen.findByRole("button", { name: "Back to welcome" }),
    );
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("allows participants to screen share", async () => {
    render(
      <MeetingView
        role="participant"
        token="participant-token"
        onBack={() => {}}
      />,
    );

    await screen.findByTestId("primary-view");

    expect(latestToolbarProps.allowScreenShare).toBe(true);
    expect(latestToolbarProps.showRecording).toBe(false);
  });
});
