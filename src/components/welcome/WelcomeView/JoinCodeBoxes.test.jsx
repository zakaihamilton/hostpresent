import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { JoinCodeBoxes } from "./JoinCodeBoxes";

function ControlledJoinCodeBoxes() {
  const [value, setValue] = useState("ABC-DEF");
  return <JoinCodeBoxes value={value} onChange={setValue} />;
}

describe("JoinCodeBoxes", () => {
  it.each(["{Backspace}", "{Delete}"])(
    "clears a populated character with %s",
    async (key) => {
      const user = userEvent.setup();
      render(<ControlledJoinCodeBoxes />);

      const character = screen.getByLabelText("Character 2");
      await user.click(character);
      await user.keyboard(key);

      expect(character).toHaveValue("C");
      expect(screen.getByLabelText("Character 6")).toHaveValue("");
      expect(character).toHaveFocus();
    },
  );

  it("preserves paste formatting and arrow-key navigation", async () => {
    const user = userEvent.setup();
    render(<ControlledJoinCodeBoxes />);

    const first = screen.getByLabelText("Character 1");
    await user.click(first);
    await user.paste("xyz123");
    expect(screen.getByLabelText("Character 6")).toHaveValue("3");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByLabelText("Character 5")).toHaveFocus();
  });
});
