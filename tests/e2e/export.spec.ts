import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  contextSampleRate,
  gotoPlayer,
  openTrack,
  TRACK_SECONDS,
} from "./helpers";

const DEFAULT_RATE = 0.85;
const HEADER_BYTES = 44;

test.describe("exporting a WAV", () => {
  test("writes a 16-bit PCM RIFF named after the track", async ({ page }) => {
    await gotoPlayer(page);
    await openTrack(page);
    const rate = await contextSampleRate(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/-lofi\.wav$/);
    expect(download.suggestedFilename()).toBe("sweep-lofi.wav");

    const path = await download.path();
    const wav = await readFile(path);
    const ascii = (offset: number, length: number): string =>
      wav.toString("ascii", offset, offset + length);

    expect(ascii(0, 4)).toBe("RIFF");
    expect(ascii(8, 4)).toBe("WAVE");
    expect(ascii(12, 4)).toBe("fmt ");
    expect(wav.readUInt32LE(16)).toBe(16);
    expect(wav.readUInt16LE(20)).toBe(1);

    const channels = wav.readUInt16LE(22);
    expect(channels).toBe(2);
    // decodeAudioData resamples to the hardware rate, and the export runs at
    // the decoded track's rate. Both engines report 44100 on this machine.
    expect(wav.readUInt32LE(24)).toBe(rate);
    expect(wav.readUInt32LE(28)).toBe(rate * channels * 2);
    expect(wav.readUInt16LE(32)).toBe(channels * 2);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(ascii(36, 4)).toBe("data");

    // A slower playback rate stretches the render: ceil(frames / rate) frames.
    const frames = Math.ceil((TRACK_SECONDS * rate) / DEFAULT_RATE);
    const dataBytes = wav.readUInt32LE(40);
    expect(dataBytes).toBe(frames * channels * 2);
    expect(dataBytes).toBe(wav.length - HEADER_BYTES);
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
  });

  test("says what it saved", async ({ page }) => {
    await gotoPlayer(page);
    await openTrack(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    await downloadPromise;

    await expect(page.locator('p[role="status"]')).toHaveText(
      "Saved sweep-lofi.wav",
    );
  });

  test("takes the notice back down again", async ({ page }) => {
    await gotoPlayer(page);
    await openTrack(page);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    await downloadPromise;
    await expect(page.locator('p[role="status"]')).toBeVisible();

    // The notice is on a four-second timer, which is the thing under test.
    await expect(page.locator('p[role="status"]')).toHaveCount(0, {
      timeout: 8_000,
    });
  });
});
