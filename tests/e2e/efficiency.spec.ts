import { expect, test, type CDPSession } from "@playwright/test";
import { gotoPlayer, openTrack, playButton } from "./helpers";

interface Metric {
  name: string;
  value: number;
}

const read = async (client: CDPSession): Promise<Metric[]> =>
  (await client.send("Performance.getMetrics")).metrics;

const valueOf = (metrics: Metric[], name: string): number => {
  const found = metrics.find((metric) => metric.name === name);
  if (!found) throw new Error(`the browser reported no ${name} metric`);
  return found.value;
};

/**
 * The engine's playhead travels as tick events straight to the canvas, never as
 * React state. If that ever regresses, the page re-renders sixty times a second
 * and these counters explode.
 */
test.describe("playback stays off the render path", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Performance.getMetrics is a Chrome DevTools Protocol domain",
  );

  test("two seconds of playback costs almost no layout or style work", async ({
    page,
  }) => {
    await gotoPlayer(page);
    await openTrack(page);
    const client = await page.context().newCDPSession(page);
    await client.send("Performance.enable");

    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute("aria-label", "Pause");
    // The transport's play/pause icon is a spring; let it settle so the sample
    // is steady-state playback and not a one-off transition.
    await page.waitForTimeout(800);
    const before = await read(client);

    await page.waitForTimeout(2_000);

    const after = await read(client);
    const grew = (name: string): number =>
      valueOf(after, name) - valueOf(before, name);

    const layout = grew("LayoutCount");
    const style = grew("RecalcStyleCount");
    expect(layout, `LayoutCount grew by ${layout}`).toBeLessThan(10);
    expect(style, `RecalcStyleCount grew by ${style}`).toBeLessThan(10);

    const heapBefore = valueOf(before, "JSHeapUsedSize");
    const heapAfter = valueOf(after, "JSHeapUsedSize");
    expect(
      heapAfter,
      `JSHeapUsedSize went ${heapBefore} -> ${heapAfter}`,
    ).toBeLessThan(heapBefore * 1.2);
  });
});
