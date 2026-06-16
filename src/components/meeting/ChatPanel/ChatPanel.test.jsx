import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPanel } from "./ChatPanel";

function makeMessage(overrides = {}) {
  return {
    id: "msg-1",
    senderId: "participant-1",
    senderName: "Alice",
    text: "Hello everyone",
    timestamp: Date.now(),
    isPrivate: false,
    isSelf: false,
    ...overrides,
  };
}

function renderChatPanel(props = {}) {
  const handlers = {
    onClose: jest.fn(),
    onSendMessage: jest.fn(),
  };
  const view = render(
    <ChatPanel
      visible
      messages={[]}
      participants={[]}
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers };
}

describe("ChatPanel", () => {
  describe("empty state", () => {
    it("renders empty state when no messages", () => {
      renderChatPanel();
      expect(screen.getByText("No messages yet")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Send a message to everyone or privately to a participant.",
        ),
      ).toBeInTheDocument();
    });

    it("renders header with Chat icon and title", () => {
      renderChatPanel();
      expect(screen.getByText("Chat")).toBeInTheDocument();
    });
  });

  describe("visibility", () => {
    it("is hidden when visible is false", () => {
      const { container } = renderChatPanel({ visible: false });
      const slot = container.firstChild;
      expect(slot).toHaveAttribute("aria-hidden", "true");
    });

    it("is not aria-hidden when visible", () => {
      renderChatPanel({ visible: true });
      const aside = screen.getByRole("complementary");
      // The wrapper div has aria-hidden=false when visible
      expect(aside.parentElement).not.toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("close button", () => {
    it("calls onClose when close button clicked", async () => {
      const user = userEvent.setup();
      const { onClose } = renderChatPanel();
      await user.click(screen.getByLabelText("Close chat"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not render close button when onClose is not provided", () => {
      renderChatPanel({ onClose: undefined });
      expect(screen.queryByLabelText("Close chat")).not.toBeInTheDocument();
    });
  });

  describe("message display", () => {
    it("renders messages with sender name and text", () => {
      const messages = [makeMessage({ senderName: "Alice", text: "Hi there" })];
      renderChatPanel({ messages });
      expect(screen.getByText("Hi there")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    it("renders 'You' for self messages", () => {
      const messages = [makeMessage({ isSelf: true, senderName: "Me" })];
      renderChatPanel({ messages });
      expect(screen.getByText("You")).toBeInTheDocument();
    });

    it("renders 'Guest' when no sender name", () => {
      const messages = [makeMessage({ senderName: "" })];
      renderChatPanel({ messages });
      expect(screen.getByText("Guest")).toBeInTheDocument();
    });

    it("shows private badge on private messages", () => {
      const messages = [makeMessage({ isPrivate: true })];
      renderChatPanel({ messages });
      expect(screen.getByText("private")).toBeInTheDocument();
    });

    it("does not show private badge on public messages", () => {
      const messages = [makeMessage({ isPrivate: false })];
      renderChatPanel({ messages });
      expect(screen.queryByText("private")).not.toBeInTheDocument();
    });

    it("renders multiple messages", () => {
      const messages = [
        makeMessage({ id: "m1", text: "First" }),
        makeMessage({ id: "m2", text: "Second", senderName: "Bob" }),
      ];
      renderChatPanel({ messages });
      expect(screen.getByText("First")).toBeInTheDocument();
      expect(screen.getByText("Second")).toBeInTheDocument();
    });

    it("formats timestamp as locale time string", () => {
      const ts = new Date(2024, 0, 15, 14, 30, 0).getTime();
      const messages = [makeMessage({ timestamp: ts })];
      renderChatPanel({ messages });
      const expected = new Date(ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });

  describe("send message", () => {
    it("calls onSendMessage with trimmed text on button click", async () => {
      const user = userEvent.setup();
      const { onSendMessage } = renderChatPanel();
      const input = screen.getByLabelText("Chat message");
      await user.type(input, "  Hello!  ");
      await user.click(screen.getByLabelText("Send message"));
      expect(onSendMessage).toHaveBeenCalledWith("Hello!");
    });

    it("clears input after sending", async () => {
      const user = userEvent.setup();
      renderChatPanel();
      const input = screen.getByLabelText("Chat message");
      await user.type(input, "Hello");
      await user.click(screen.getByLabelText("Send message"));
      expect(input).toHaveValue("");
    });

    it("disables send button when input is empty", () => {
      renderChatPanel();
      expect(screen.getByLabelText("Send message")).toBeDisabled();
    });

    it("enables send button when input has text", async () => {
      const user = userEvent.setup();
      renderChatPanel();
      const input = screen.getByLabelText("Chat message");
      await user.type(input, "Hi");
      expect(screen.getByLabelText("Send message")).toBeEnabled();
    });

    it("sends on Enter key", async () => {
      const user = userEvent.setup();
      const { onSendMessage } = renderChatPanel();
      const input = screen.getByLabelText("Chat message");
      await user.type(input, "Enter send{Enter}");
      expect(onSendMessage).toHaveBeenCalledWith("Enter send");
    });

    it("does not send on Shift+Enter", async () => {
      const user = userEvent.setup();
      const { onSendMessage } = renderChatPanel();
      const input = screen.getByLabelText("Chat message");
      await user.type(input, "no send");
      await user.keyboard("{Shift>}{Enter}{/Shift}");
      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it("does not send empty or whitespace-only text", async () => {
      const user = userEvent.setup();
      const { onSendMessage } = renderChatPanel();
      await user.click(screen.getByLabelText("Send message"));
      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it("calls onSendMessage with recipientId for private message", async () => {
      const user = userEvent.setup();
      const participants = [{ id: "p1", name: "Bob" }];
      const { onSendMessage } = renderChatPanel({ participants });

      await user.click(screen.getByLabelText("Select message recipient"));
      const options = screen.getAllByRole("option");
      const bobOption = options.find((o) => o.textContent.includes("Bob"));
      await user.click(bobOption);

      const input = screen.getByLabelText("Chat message");
      await user.type(input, "Hey Bob");
      await user.click(screen.getByLabelText("Send message"));

      expect(onSendMessage).toHaveBeenCalledWith("Hey Bob", "p1");
    });
  });

  describe("recipient dropdown", () => {
    it("shows 'Everyone' by default", () => {
      renderChatPanel();
      expect(screen.getByText("Everyone")).toBeInTheDocument();
    });

    it("opens dropdown when trigger is clicked", async () => {
      const user = userEvent.setup();
      const participants = [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
      ];
      renderChatPanel({ participants });

      await user.click(screen.getByLabelText("Select message recipient"));

      const listbox = screen.getByRole("listbox");
      expect(listbox).toBeInTheDocument();
      expect(within(listbox).getByText("Alice")).toBeInTheDocument();
      expect(within(listbox).getByText("Bob")).toBeInTheDocument();
    });

    it("lists everyone plus all participants as options", async () => {
      const user = userEvent.setup();
      const participants = [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
      ];
      renderChatPanel({ participants });

      await user.click(screen.getByLabelText("Select message recipient"));

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(3);
      expect(options[0].textContent).toContain("Everyone");
    });

    it("selects a participant and shows their name on trigger", async () => {
      const user = userEvent.setup();
      const participants = [{ id: "p1", name: "Alice" }];
      renderChatPanel({ participants });

      await user.click(screen.getByLabelText("Select message recipient"));
      const options = screen.getAllByRole("option");
      const aliceOption = options.find((o) => o.textContent.includes("Alice"));
      await user.click(aliceOption);

      // Trigger should now show the selected name
      const trigger = screen.getByLabelText("Select message recipient");
      expect(within(trigger).getByText("Alice")).toBeInTheDocument();
    });

    it("shows 'Everyone' option as selected by default", async () => {
      const user = userEvent.setup();
      renderChatPanel({ participants: [{ id: "p1", name: "Alice" }] });

      await user.click(screen.getByLabelText("Select message recipient"));

      const listbox = screen.getByRole("listbox");
      const everyoneOption = within(listbox)
        .getByText("Everyone")
        .closest('[role="option"]');
      expect(everyoneOption).toHaveAttribute("aria-selected", "true");
    });

    it("shows selected state on the chosen participant", async () => {
      const user = userEvent.setup();
      const participants = [{ id: "p1", name: "Alice" }];
      renderChatPanel({ participants });

      await user.click(screen.getByLabelText("Select message recipient"));
      const options = screen.getAllByRole("option");
      const aliceOption = options.find((o) => o.textContent.includes("Alice"));
      await user.click(aliceOption);

      // Re-open to check Alice is now selected
      await user.click(screen.getByLabelText("Select message recipient"));
      const allOptions = screen.getAllByRole("option");
      const selectedAlice = allOptions.find(
        (o) =>
          o.textContent.includes("Alice") &&
          o.getAttribute("aria-selected") === "true",
      );
      expect(selectedAlice).toBeTruthy();
    });

    it("shows '(private)' hint when a recipient is selected", async () => {
      const user = userEvent.setup();
      const participants = [{ id: "p1", name: "Alice" }];
      renderChatPanel({ participants });

      await user.click(screen.getByLabelText("Select message recipient"));
      const options = screen.getAllByRole("option");
      const aliceOption = options.find((o) => o.textContent.includes("Alice"));
      await user.click(aliceOption);

      expect(screen.getByText("(private)")).toBeInTheDocument();
    });

    it("updates placeholder for private message", async () => {
      const user = userEvent.setup();
      const participants = [{ id: "p1", name: "Alice" }];
      renderChatPanel({ participants });

      await user.click(screen.getByLabelText("Select message recipient"));
      const options = screen.getAllByRole("option");
      const aliceOption = options.find((o) => o.textContent.includes("Alice"));
      await user.click(aliceOption);

      expect(
        screen.getByPlaceholderText("Message Alice\u2026"),
      ).toBeInTheDocument();
    });

    it("closes dropdown when clicking outside", async () => {
      const user = userEvent.setup();
      renderChatPanel({ participants: [{ id: "p1", name: "Alice" }] });

      await user.click(screen.getByLabelText("Select message recipient"));
      const listbox = screen.getByRole("listbox");
      expect(listbox).toBeInTheDocument();

      await user.click(document.body);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("closes dropdown on Escape key", async () => {
      const user = userEvent.setup();
      renderChatPanel({ participants: [{ id: "p1", name: "Alice" }] });

      await user.click(screen.getByLabelText("Select message recipient"));
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  describe("flex prop", () => {
    it("applies flex class when flex is true", () => {
      const { container } = renderChatPanel({ flex: true });
      const slot = container.firstChild;
      expect(slot.className).toContain("slotFlex");
    });

    it("does not apply flex class when flex is not set", () => {
      const { container } = renderChatPanel();
      const slot = container.firstChild;
      expect(slot.className).not.toContain("slotFlex");
    });
  });

  describe("participants list", () => {
    it("renders recipient dropdown when participants are provided", () => {
      renderChatPanel({ participants: [{ id: "p1", name: "Alice" }] });
      expect(
        screen.getByLabelText("Select message recipient"),
      ).toBeInTheDocument();
    });
  });
});
