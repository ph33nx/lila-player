import { expect, test } from "@playwright/test";
import {
  currentSeconds,
  gotoPlayer,
  loopButton,
  openTrack,
  playButton,
  seekToFraction,
  slider,
  TRACK_LABEL,
} from "./helpers";

/** Fractions of the track that floor to a whole second with room to spare. */
const A_FRACTION = 0.35; // 1.05 s -> 0:01
const B_FRACTION = 0.83; // 2.49 s -> 0:02

test.describe("looping the whole track", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPlayer(page);
    await openTrack(page);
    await slider(page, "Speed").press("End");
    await expect(page.getByTestId("value-speed")).toHaveText("1.35x");
  });

  test("keeps playing past the end and wraps the clock", async ({ page }) => {
    await expect(loopButton(page)).toHaveAttribute("aria-pressed", "true");

    await playButton(page).click();
    // 3.5 s at 1.35x is past the end of a 3 s track: the wrap is the point.
    await page.waitForTimeout(3_500);

    await expect(playButton(page)).toHaveAttribute("aria-label", "Pause");
    expect(await currentSeconds(page)).toBeLessThan(3);
  });

  test("stops at the end once looping is switched off", async ({ page }) => {
    await loopButton(page).click();
    await expect(loopButton(page)).toHaveAttribute("aria-pressed", "false");

    await playButton(page).click();

    await expect(playButton(page)).toHaveAttribute("aria-label", "Play", {
      timeout: 10_000,
    });
    await expect(page.getByTestId("current-time")).toHaveText("0:00");
  });
});

test.describe("loop points", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPlayer(page);
    await openTrack(page);
    await page.getByRole("button", { name: "Advanced" }).click();
    await expect(
      page.getByRole("button", { name: "Advanced" }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("advanced-panel")).toBeVisible();
  });

  test("Set records the start and end of the section", async ({ page }) => {
    await seekToFraction(page, A_FRACTION);
    await page.getByTestId("set-loop-start").click();
    await seekToFraction(page, B_FRACTION);
    await page.getByTestId("set-loop-end").click();

    await expect(page.getByTestId("loop-start")).toHaveText("0:01");
    await expect(page.getByTestId("loop-end")).toHaveText("0:02");
  });

  test("plays the intro once, then repeats A to B", async ({ page }) => {
    await seekToFraction(page, A_FRACTION);
    await page.getByTestId("set-loop-start").click();
    await seekToFraction(page, B_FRACTION);
    await page.getByTestId("set-loop-end").click();
    await seekToFraction(page, 0.01);
    const label = page.getByTestId("current-time");
    await expect(label).toHaveText("0:00");

    await playButton(page).click();

    // Through the intro, up to B, then back to A: only a wrap can return it.
    await expect(label).toHaveText("0:01", { timeout: 5_000 });
    await expect(label).toHaveText("0:02", { timeout: 5_000 });
    await expect(label).toHaveText("0:01", { timeout: 5_000 });
  });

  test("Clear puts the region back to the whole track", async ({ page }) => {
    await seekToFraction(page, A_FRACTION);
    await page.getByTestId("set-loop-start").click();
    await seekToFraction(page, B_FRACTION);
    await page.getByTestId("set-loop-end").click();
    await expect(page.getByTestId("loop-end")).toHaveText("0:02");

    await page.getByTestId("clear-loop").click();

    await expect(page.getByTestId("loop-start")).toHaveText("0:00");
    await expect(page.getByTestId("loop-end")).toHaveText(TRACK_LABEL);
  });
});
