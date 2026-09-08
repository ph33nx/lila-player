import { expect, test } from "@playwright/test";
import {
  currentSeconds,
  gotoPlayer,
  loopButton,
  openTrack,
  playButton,
  slider,
} from "./helpers";

test.describe("playback", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPlayer(page);
    await openTrack(page);
  });

  test("Play becomes Pause and the clock starts running", async ({ page }) => {
    await playButton(page).click();

    await expect(playButton(page)).toHaveAttribute("aria-label", "Pause");
    await expect(page.getByTestId("current-time")).toHaveText("0:01", {
      timeout: 2_000,
    });
  });

  test("Pause freezes the clock where it stood", async ({ page }) => {
    await playButton(page).click();
    await expect(page.getByTestId("current-time")).toHaveText("0:01", {
      timeout: 2_000,
    });

    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute("aria-label", "Play");
    const stopped = await page.getByTestId("current-time").innerText();
    // The point of the test is that real time passes and the clock does not.
    await page.waitForTimeout(800);

    await expect(page.getByTestId("current-time")).toHaveText(stopped);
  });

  test("Space toggles playback from anywhere on the page", async ({ page }) => {
    await page.locator("body").press("Space");
    await expect(playButton(page)).toHaveAttribute("aria-label", "Pause");

    await page.locator("body").press("Space");

    await expect(playButton(page)).toHaveAttribute("aria-label", "Play");
  });

  test("ArrowRight seeks forward, clamped to the end of the track", async ({
    page,
  }) => {
    await expect(page.getByTestId("current-time")).toHaveText("0:00");

    await page.locator("body").press("ArrowRight");

    // One 5-second step is past the end of a 3-second track.
    await expect(page.getByTestId("current-time")).toHaveText("0:03");
  });

  test("Play after the natural end restarts from the beginning", async ({
    page,
  }) => {
    await loopButton(page).click();
    await expect(loopButton(page)).toHaveAttribute("aria-pressed", "false");
    await slider(page, "Speed").press("End");
    await expect(page.getByTestId("value-speed")).toHaveText("1.35x");

    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute("aria-label", "Play", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("current-time")).toHaveText("0:00");

    await playButton(page).click();

    await expect(playButton(page)).toHaveAttribute("aria-label", "Pause");
    await expect.poll(() => currentSeconds(page), { timeout: 3_000 }).toBe(1);
  });
});
