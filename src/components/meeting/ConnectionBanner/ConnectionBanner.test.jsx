import { render, screen } from "@testing-library/react";
import { ConnectionBanner } from "./ConnectionBanner";

describe("ConnectionBanner", () => {
  it("shows host waiting banner with error when participant and host not present", () => {
    render(
      <ConnectionBanner
        isHost={false}
        hostPresent={false}
        connectionError="Room not found"
        isWaitingForHost={false}
        isFatalConnectionError={false}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Room not found");
  });

  it("shows waiting for host when participant and host not present without error", () => {
    render(
      <ConnectionBanner
        isHost={false}
        hostPresent={false}
        connectionError={null}
        isWaitingForHost={false}
        isFatalConnectionError={false}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Waiting for the host to start the session.",
    );
  });

  it("does not show host waiting banner when host is present", () => {
    render(
      <ConnectionBanner
        isHost={false}
        hostPresent={true}
        connectionError={null}
        isWaitingForHost={false}
        isFatalConnectionError={false}
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows signaling error for participant when connection has error", () => {
    render(
      <ConnectionBanner
        isHost={false}
        hostPresent={true}
        connectionError="Connection lost"
        isWaitingForHost={false}
        isFatalConnectionError={false}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Connection lost");
  });

  it("shows signaling error for host when connection has error", () => {
    render(
      <ConnectionBanner
        isHost={true}
        hostPresent={true}
        connectionError="Server error"
        isWaitingForHost={false}
        isFatalConnectionError={false}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Server error");
  });

  it("does not show signaling error when there is a fatal connection error", () => {
    render(
      <ConnectionBanner
        isHost={true}
        hostPresent={true}
        connectionError="Fatal error"
        isWaitingForHost={false}
        isFatalConnectionError={true}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show any banners when host present and no connection error", () => {
    render(
      <ConnectionBanner
        isHost={true}
        hostPresent={true}
        connectionError={null}
        isWaitingForHost={false}
        isFatalConnectionError={false}
      />,
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show signaling error when waiting for host message", () => {
    render(
      <ConnectionBanner
        isHost={false}
        hostPresent={true}
        connectionError="Waiting for host"
        isWaitingForHost={true}
        isFatalConnectionError={false}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
