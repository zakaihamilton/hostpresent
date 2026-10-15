import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecentRoomsTrigger } from "./RecentRoomsTrigger";

const rooms = [{ hostToken: "host-1", label: "Room A" }];

describe("RecentRoomsTrigger", () => {
  it("opens the recent rooms popup", async () => {
    const user = userEvent.setup();

    render(
      <RecentRoomsTrigger
        rooms={rooms}
        activeToken="host-1"
        tokenKey="hostToken"
        formatLabel={(room) => room.label}
        onSelect={() => {}}
        onClear={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Recent rooms (1)" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Recent rooms (1)" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
