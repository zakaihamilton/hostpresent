import { render, screen } from "@testing-library/react";
import { VirtualList } from "./VirtualList";

describe("VirtualList", () => {
  it("renders visible items", () => {
    const items = ["One", "Two", "Three"];

    render(
      <VirtualList
        items={items}
        getItemSize={() => 40}
        renderItem={(item) => <span>{item}</span>}
        ariaLabel="Test list"
      />,
    );

    expect(screen.getByLabelText("Test list")).toBeInTheDocument();
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
  });

  it("uses custom item keys", () => {
    const items = [{ id: "a", label: "Alpha" }];

    render(
      <VirtualList
        items={items}
        getItemSize={() => 40}
        itemKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });
});
