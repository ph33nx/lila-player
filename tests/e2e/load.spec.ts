import { expect, test } from "@playwright/test";
import { toPlaywrightFile } from "./fixtures/wav";
import {
  gotoPlayer,
  headerOpen,
  openTrack,
  opaquePixels,
  pickFile,
  TRACK_LABEL,
} from "./helpers";

test.describe("loading a track", () => {
  test("names the file the empty state opened and shows its length", async ({
    page,
  }) => {
    await gotoPlayer(page);

    await openTrack(page, "sweep.wav");

    await expect(page.getByTestId("track-title")).toHaveText("sweep.wav");
    await expect(page.getByTestId("duration")).toHaveText(TRACK_LABEL);
  });

  test("replaces the track when the header button opens a second file", async ({
    page,
  }) => {
    await gotoPlayer(page);
    await openTrack(page, "first.wav");

    await pickFile(page, headerOpen(page), toPlaywrightFile("second.wav"));

    await expect(page.getByTestId("track-title")).toHaveText("second.wav");
    await expect(page.getByTestId("duration")).toHaveText(TRACK_LABEL);
    await expect(page.getByTestId("current-time")).toHaveText("0:00");
  });

  test("draws the waveform onto the canvas", async ({ page }) => {
    await gotoPlayer(page);

    await openTrack(page);

    await expect
      .poll(() => opaquePixels(page), { timeout: 5_000 })
      .toBeGreaterThan(0);
  });

  test("loads and opens without an uncaught page error", async ({ page }) => {
    const errors = await gotoPlayer(page);

    await openTrack(page);
    await expect
      .poll(() => opaquePixels(page), { timeout: 5_000 })
      .toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });
});
