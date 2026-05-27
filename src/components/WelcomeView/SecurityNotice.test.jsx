import { render, screen, waitFor } from "@testing-library/react";
import { SecurityNotice } from "./SecurityNotice";

describe("SecurityNotice", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows notice when encryption is disabled", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        encrypted: false,
        signalingServerConfigured: true,
      }),
    });

    render(<SecurityNotice />);

    await waitFor(() => {
      expect(screen.getByText(/Not encrypted/i)).toBeInTheDocument();
    });
  });

  it("stays hidden when encryption is enabled", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        encrypted: true,
        signalingServerConfigured: true,
      }),
    });

    const { container } = render(<SecurityNotice />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/rooms/config");
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("shows notice when signaling is not configured", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        encrypted: false,
        signalingServerConfigured: false,
      }),
    });

    render(<SecurityNotice />);

    await waitFor(() => {
      expect(screen.getByText(/Signaling not configured/i)).toBeInTheDocument();
    });
  });
});
