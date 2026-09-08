import { expect, type Locator, type Page } from "@playwright/test";
import { toPlaywrightFile, type PlaywrightFile } from "./fixtures/wav";

/** The fixture track's length, and the label the duration readout shows for it. */
export const TRACK_SECONDS = 3;
export const TRACK_LABEL = "0:03";

/**
 * Navigate to the player and start collecting uncaught page errors. The
 * listener has to be attached before the navigation, so this returns the array
 * rather than taking one.
 */
export const gotoPlayer = async (page: Page): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("track-title")).toHaveText("No track open");
  return errors;
};

/** The empty state's button: the only "Open audio" before a track is loaded. */
export const emptyStateOpen = (page: Page): Locator =>
  page.getByRole("button", { name: "Open audio" });

/** The header's button, which exists only once a track is loaded. */
export const headerOpen = (page: Page): Locator =>
  page.locator("header").getByRole("button", { name: "Open audio" });

/** One button whose accessible name follows the state. */
export const playButton = (page: Page): Locator =>
  page.getByRole("button", { name: /^(Play|Pause)$/ });

/** "Clear loop section" contains "loop", so this has to be exact. */
export const loopButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Loop", exact: true });

export const slider = (page: Page, name: string): Locator =>
  page.getByRole("slider", { name });

/** The input is hidden, so it is driven through the chooser the button opens. */
export const pickFile = async (
  page: Page,
  button: Locator,
  file: PlaywrightFile,
): Promise<void> => {
  const chooser = page.waitForEvent("filechooser");
  await button.click();
  await (await chooser).setFiles(file);
};

/** Open the sweep fixture and wait for the engine to publish it. */
export const openTrack = async (
  page: Page,
  name = "sweep.wav",
): Promise<void> => {
  await pickFile(page, emptyStateOpen(page), toPlaywrightFile(name));
  await expect(page.getByTestId("track-title")).toHaveText(name);
  await expect(page.getByTestId("duration")).toHaveText(TRACK_LABEL);
};

/** Seconds behind an `m:ss` label. */
export const labelSeconds = (label: string): number => {
  const [minutes, seconds] = label.trim().split(":");
  return Number(minutes) * 60 + Number(seconds);
};

export const currentSeconds = async (page: Page): Promise<number> =>
  labelSeconds(await page.getByTestId("current-time").innerText());

/** Click the waveform at a fraction of its width, which seeks there. */
export const seekToFraction = async (
  page: Page,
  fraction: number,
): Promise<void> => {
  const canvas = page.getByTestId("waveform");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("the waveform canvas has no bounding box");
  await canvas.click({
    position: { x: box.width * fraction, y: box.height / 2 },
  });
};

/** How many canvas pixels have a non-zero alpha: proof that something was drawn. */
export const opaquePixels = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="waveform"]',
    );
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return -1;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque += 1;
    return opaque;
  });

/** The sample rate the browser's audio hardware runs at, which decode resamples to. */
export const contextSampleRate = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const ctx = new AudioContext();
    const rate = ctx.sampleRate;
    void ctx.close();
    return rate;
  });
