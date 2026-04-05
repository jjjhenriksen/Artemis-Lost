import { fireEvent, render, screen } from "@testing-library/react";
import CharacterCreation from "../src/screens/CharacterCreation.jsx";
import { DEFAULT_THEME_ID } from "../src/game/themes.js";

describe("CharacterCreation", () => {
  test("locked profiles cannot be rerolled individually", () => {
    render(
      <CharacterCreation
        onBack={() => {}}
        onStartMission={() => {}}
        slotId="slot-1"
        themeId={DEFAULT_THEME_ID}
        themes={[]}
        onThemeChange={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Jacqueline Henriksen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Crew" }));

    const lockButtons = screen.getAllByRole("button", { name: "Unlocked" });
    fireEvent.click(lockButtons[0]);

    const rerollButtons = screen.getAllByRole("button", { name: "Reroll This" });
    expect(rerollButtons.filter((button) => button.disabled)).toHaveLength(2);
    expect(rerollButtons.filter((button) => !button.disabled)).toHaveLength(2);
  });
});
