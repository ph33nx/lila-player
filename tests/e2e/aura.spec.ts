import { expect, test } from "@playwright/test";
import { gotoPlayer, openTrack, playButton } from "./helpers";

test.describe("the aura", () => {
  test("breathes only while playing and never takes the pointer", async ({
    page,
  }) => {
    await gotoPlayer(page);
    const aura = page.getByTestId("aura");
    await expect(aura).toHaveAttribute("data-active", "false");

    await openTrack(page);
    await playButton(page).click();
    await expect(aura).toHaveAttribute("data-active", "true");
    expect(
      await aura.evaluate((node) => getComputedStyle(node).pointerEvents),
    ).toBe("none");

    await playButton(page).click();
    await expect(aura).toHaveAttribute("data-active", "false");
  });

  test("stays still under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoPlayer(page);
    await openTrack(page);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName("Pause");
    await expect(page.getByTestId("aura")).toHaveAttribute(
      "data-active",
      "false",
    );
  });
});
