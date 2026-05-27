import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordingDownloadBanner } from "./RecordingDownloadBanner";

describe("RecordingDownloadBanner", () => {
  it("renders nothing without download state", () => {
    const { container } = render(
      <RecordingDownloadBanner downloadState={null} onDismiss={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows progress while building", () => {
    render(
      <RecordingDownloadBanner
        downloadState={{
          phase: "building",
          progress: 42,
          filename: "meeting.webm",
        }}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByText("Preparing your file…")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("meeting.webm")).toBeInTheDocument();
  });

  it("allows dismiss when complete", async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();

    render(
      <RecordingDownloadBanner
        downloadState={{
          phase: "complete",
          progress: 100,
          filename: "meeting.webm",
        }}
        onDismiss={onDismiss}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
