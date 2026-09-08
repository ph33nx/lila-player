import { expect, test } from "@playwright/test";
import { gotoPlayer, openTrack, playButton, seekToFraction } from "./helpers";

test.describe("seeking on the waveform", () => {
  test("a click halfway across lands halfway through the track", async ({
    page,
  }) => {
    await gotoPlayer(page);
    await openTrack(page);

    await seekToFraction(page, 0.5);

    // Half of three seconds, floored to whole seconds by the label.
    await expect(page.getByTestId("current-time")).toHaveText("0:01");
  });

  test("dragging across the waveform scrubs the playhead", async ({ page }) => {
    const errors = await gotoPlayer(page);
    await openTrack(page);
    const box = await page.getByTestId("waveform").boundingBox();
    if (!box) throw new Error("the waveform canvas has no bounding box");
    const y = box.y + box.height / 2;
    const at = (fraction: number): number => box.x + box.width * fraction;

    await page.mouse.move(at(0.2), y);
    await page.mouse.down();
    await page.mouse.move(at(0.5), y, { steps: 8 });
    await page.mouse.move(at(0.8), y, { steps: 8 });
    await page.mouse.up();

    // 80% of three seconds is 2.4.
    await expect(page.getByTestId("current-time")).toHaveText("0:02");
    expect(errors).toEqual([]);
  });

  test("seeking while playing leaves the track playing", async ({ page }) => {
    await gotoPlayer(page);
    await openTrack(page);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute("aria-label", "Pause");

    await seekToFraction(page, 0.3);

    await expect(playButton(page)).toHaveAttribute("aria-label", "Pause");
  });
});
