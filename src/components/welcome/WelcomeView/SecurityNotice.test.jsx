import { render, screen, waitFor } from "@testing-library/react";
import { SecurityNotice } from "./SecurityNotice";

describe("SecurityNotice", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows notice when room signing is not configured", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        roomSigningConfigured: false,
        signalingServerConfigured: true,
      }),
    });

    render(<SecurityNotice />);

    await waitFor(() => {
      expect(
        screen.getByText(/Room signing is not configured/i),
      ).toBeInTheDocument();
    });
  });

  it("stays hidden when signing and signaling are configured", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        roomSigningConfigured: true,
        signalingServerConfigured: true,
      }),
    });

    const { container } = render(<SecurityNotice />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/rooms/config", {
        cache: "no-store",
      });
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("shows notice when signaling is not configured", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        roomSigningConfigured: true,
        signalingServerConfigured: false,
      }),
    });

    render(<SecurityNotice />);

    await waitFor(() => {
      expect(screen.getByText(/Signaling not configured/i)).toBeInTheDocument();
    });
  });
});
