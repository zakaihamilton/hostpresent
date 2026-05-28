import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InviteBar } from "./InviteBar";

describe("InviteBar", () => {
  it("renders the invite link input", () => {
    render(
      <InviteBar
        inviteLink="https://example.com/j/ABCD"
        inviteCopyMessage=""
        onCopyInviteLink={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByLabelText("Participant invite link")).toHaveValue(
      "https://example.com/j/ABCD",
    );
  });

  it("shows copy button with default label", () => {
    render(
      <InviteBar
        inviteLink="https://example.com/j/ABCD"
        inviteCopyMessage=""
        onCopyInviteLink={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
  });

  it("shows Copied! when the link was copied", () => {
    render(
      <InviteBar
        inviteLink="https://example.com/j/ABCD"
        inviteCopyMessage="Copied!"
        onCopyInviteLink={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: /copied!/i }),
    ).toBeInTheDocument();
  });

  it("shows Copy failed when copy fails", () => {
    render(
      <InviteBar
        inviteLink="https://example.com/j/ABCD"
        inviteCopyMessage="Copy failed"
        onCopyInviteLink={() => {}}
        onDismiss={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: /copy failed/i }),
    ).toBeInTheDocument();
  });

  it("calls onCopyInviteLink when the copy button is clicked", async () => {
    const user = userEvent.setup();
    const onCopyInviteLink = jest.fn();

    render(
      <InviteBar
        inviteLink="https://example.com/j/ABCD"
        inviteCopyMessage=""
        onCopyInviteLink={onCopyInviteLink}
        onDismiss={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(onCopyInviteLink).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();

    render(
      <InviteBar
        inviteLink="https://example.com/j/ABCD"
        inviteCopyMessage=""
        onCopyInviteLink={() => {}}
        onDismiss={onDismiss}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Hide invite link" }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
