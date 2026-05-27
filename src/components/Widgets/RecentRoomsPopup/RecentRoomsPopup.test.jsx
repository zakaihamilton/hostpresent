import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecentRoomsPopup } from "./RecentRoomsPopup";

const rooms = [
  { hostToken: "host-1", label: "Room A" },
  { hostToken: "host-2", label: "Room B" },
];

describe("RecentRoomsPopup", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <RecentRoomsPopup
        rooms={rooms}
        activeToken="host-1"
        tokenKey="hostToken"
        formatLabel={(room) => room.label}
        onSelect={() => {}}
        onClear={() => {}}
        open={false}
        onOpenChange={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists rooms and handles selection", async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <RecentRoomsPopup
        rooms={rooms}
        activeToken="host-1"
        tokenKey="hostToken"
        formatLabel={(room) => room.label}
        onSelect={onSelect}
        onClear={() => {}}
        open
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Room A")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Room B" }));
    expect(onSelect).toHaveBeenCalledWith(rooms[1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("clears recent rooms", async () => {
    const user = userEvent.setup();
    const onClear = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <RecentRoomsPopup
        rooms={rooms}
        activeToken="host-1"
        tokenKey="hostToken"
        formatLabel={(room) => room.label}
        onSelect={() => {}}
        onClear={onClear}
        open
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Clear recent rooms" }),
    );
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
