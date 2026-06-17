import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SIGNALING_MESSAGE } from "@/lib/signaling/messages";
import { MeetingView } from "./MeetingView";

const mockDisconnect = jest.fn();
const mockConfirm = jest.fn();
const mockSend = jest.fn();
const mockSendChatMessage = jest.fn();
const mockSendPrivateChatMessage = jest.fn();
let latestToolbarProps = null;
let latestHostControlsArgs = null;
let latestRoomDataChannelArgs = null;
let roomDataChannelSubscribers = [];
let mockMeetingSeconds = 0;

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

jest.mock("@/lib/recordingStorage", () => ({
  saveRecordingMeta: jest.fn().mockResolvedValue(undefined),
  saveRecordingChunk: jest.fn().mockResolvedValue(undefined),
  loadSavedRecording: jest.fn().mockResolvedValue(null),
  clearSavedRecording: jest.fn().mockResolvedValue(undefined),
}));

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
        <button type="button" onClick={props.onToggleChat}>
          Toggle chat
        </button>
        <button type="button" onClick={props.onLeave}>
          Leave meeting
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
  ChatPanel: ({ visible, messages = [], onSendMessage }) =>
    visible ? (
      <div data-testid="chat-panel">
        <span>Chat</span>
        {messages.map((message) => (
          <p key={message.id}>{message.text}</p>
        ))}
        <button type="button" onClick={() => onSendMessage("hello everyone")}>
          Send mock chat
        </button>
        <button
          type="button"
          onClick={() => onSendMessage("secret hello", "host")}
        >
          Send mock private chat
        </button>
      </div>
    ) : null,
}));

jest.mock("@/components/webrtc/PeerStreamConnection", () => ({
  PeerStreamConnection: ({ children }) => children,
  useIceServers: () => [{ urls: "stun:stun.l.google.com:19302" }],
}));

jest.mock("@/hooks", () => ({
  useConfirmDialog: () => ({
    confirm: mockConfirm,
    dialogProps: {},
  }),
  useHostControls: (args) => {
    latestHostControlsArgs = args;
    return {
      muteParticipantAudio: jest.fn(),
      muteParticipantVideo: jest.fn(),
      muteAllAudio: jest.fn(),
      muteAllVideo: jest.fn(),
      canMuteAllAudio: false,
      canMuteAllVideo: false,
    };
  },
  useSessionTimers: () => ({
    meetingSeconds: mockMeetingSeconds,
    recordingSeconds: 0,
    resetRecordingTimer: jest.fn(),
  }),
  useRoomDataChannel: (args) => {
    latestRoomDataChannelArgs = args;
    return {
      send: mockSend,
      sendChatMessage: mockSendChatMessage,
      sendPrivateChatMessage: mockSendPrivateChatMessage,
      subscribe: jest.fn((callback) => {
        roomDataChannelSubscribers.push(callback);
        return () => {};
      }),
      disconnect: mockDisconnect,
      hostPresent: true,
      localParticipantId: "participant-1",
      connectionError: null,
      status: "connected",
      isConnected: true,
    };
  },
}));

describe("MeetingView", () => {
  beforeEach(() => {
    mockDisconnect.mockClear();
    mockConfirm.mockClear();
    mockSend.mockClear();
    mockSendChatMessage.mockClear();
    mockSendPrivateChatMessage.mockClear();
    latestToolbarProps = null;
    latestHostControlsArgs = null;
    latestRoomDataChannelArgs = null;
    roomDataChannelSubscribers = [];
    mockMeetingSeconds = 0;
  });

  it("renders host meeting UI", async () => {
    render(<MeetingView token="host-token" onBack={() => {}} />);

    expect(await screen.findByTestId("primary-view")).toHaveTextContent(
      "Guest",
    );
  });

  it("disconnects signaling before navigating back", async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();

    render(<MeetingView token="host-token" onBack={onBack} />);

    await user.click(
      await screen.findByRole("button", { name: "Leave meeting" }),
    );
    expect(mockDisconnect).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("ends the meeting for everyone and navigates back when host confirms", async () => {
    mockConfirm.mockResolvedValue(true);
    const onBack = jest.fn();

    render(
      <MeetingView {...{ role: "host" }} token="host-token" onBack={onBack} />,
    );

    await screen.findByTestId("primary-view");

    await latestToolbarProps.onEndMeeting();

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "End meeting",
        variant: "danger",
      }),
    );
    expect(mockDisconnect).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("does not end the meeting when host cancels confirmation", async () => {
    mockConfirm.mockResolvedValue(false);
    const onBack = jest.fn();

    render(
      <MeetingView {...{ role: "host" }} token="host-token" onBack={onBack} />,
    );

    await screen.findByTestId("primary-view");
    await latestToolbarProps.onEndMeeting();

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "End meeting" }),
    );
    expect(mockSend).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: SIGNALING_MESSAGE.MEETING_ENDED }),
    );
    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("allows participants to screen share", async () => {
    render(<MeetingView token="participant-token" onBack={() => {}} />);

    await screen.findByTestId("primary-view");

    expect(latestToolbarProps.allowScreenShare).toBe(true);
    expect(latestToolbarProps.showRecording).toBe(false);
  });

  it.each([
    [
      SIGNALING_MESSAGE.MEETING_ENDED,
      "Meeting ended",
      "The host has ended this meeting.",
    ],
    [
      SIGNALING_MESSAGE.KICK_PARTICIPANT,
      "You were removed",
      "You were removed from the meeting by the host.",
    ],
    [
      SIGNALING_MESSAGE.ROOM_FULL,
      "Meeting is full",
      "This meeting has reached the maximum capacity of 30 participants.",
    ],
  ])("shows disconnect screen for %s", async (type, title, message) => {
    render(
      <MeetingView
        {...{ role: "participant" }}
        token="participant-token"
        onBack={() => {}}
      />,
    );

    await screen.findByTestId("primary-view");

    act(() => {
      for (const subscriber of roomDataChannelSubscribers) {
        subscriber({ type });
      }
    });

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("opens chat, sends public and private messages, and renders received chat", async () => {
    const user = userEvent.setup();

    render(
      <MeetingView
        {...{ role: "participant" }}
        token="participant-token"
        onBack={() => {}}
      />,
    );

    await screen.findByTestId("primary-view");

    act(() => {
      latestToolbarProps.onToggleChat();
    });

    expect(await screen.findByTestId("chat-panel")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send mock chat" }));
    await user.click(
      screen.getByRole("button", { name: "Send mock private chat" }),
    );

    expect(mockSendChatMessage).toHaveBeenCalledWith("hello everyone");
    expect(mockSendPrivateChatMessage).toHaveBeenCalledWith(
      "secret hello",
      "host",
    );

    act(() => {
      latestRoomDataChannelArgs.onChatMessage({
        type: SIGNALING_MESSAGE.CHAT_MESSAGE,
        senderId: "host",
        senderName: "Host",
        text: "welcome in",
        timestamp: 1,
      });
    });

    await waitFor(() => {
      expect(screen.getByText("welcome in")).toBeInTheDocument();
    });
  });

  it("passes remote participant state into host controls", async () => {
    render(
      <MeetingView
        {...{ role: "host" }}
        token="host-token"
        onBack={() => {}}
      />,
    );

    await screen.findByTestId("primary-view");

    act(() => {
      latestRoomDataChannelArgs.onRemoteParticipant({
        id: "p1",
        name: "Alex",
        stream: {
          getTracks: () => [],
          getAudioTracks: () => [],
          getVideoTracks: () => [],
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        mode: "available",
      });
    });

    await waitFor(() => {
      expect(latestHostControlsArgs.videoParticipants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "p1",
            name: "Alex",
          }),
        ]),
      );
    });
  });

  it("automatically disconnects and shows limit reached screen when 6-hour limit is reached", async () => {
    mockMeetingSeconds = 21600;
    render(<MeetingView token="participant-token" onBack={() => {}} />);

    expect(
      await screen.findByText("Meeting limit reached"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This meeting has reached the 6-hour limit."),
    ).toBeInTheDocument();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
