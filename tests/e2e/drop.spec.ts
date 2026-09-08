import { expect, test, type JSHandle, type Page } from "@playwright/test";
import { makeSineSweepWav, toPlaywrightFile } from "./fixtures/wav";
import { emptyStateOpen, gotoPlayer, pickFile, TRACK_LABEL } from "./helpers";

interface DroppedFile {
  name: string;
  type: string;
  /** Base64, because a megabyte of numbers does not belong on the wire. */
  base64: string;
}

/** Build a real DataTransfer inside the page, carrying one real File. */
const dataTransferOf = (
  page: Page,
  file: DroppedFile,
): Promise<JSHandle<DataTransfer>> =>
  page.evaluateHandle(({ name, type, base64 }: DroppedFile) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], name, { type }));
    return transfer;
  }, file);

const audioDrop = (page: Page): Promise<JSHandle<DataTransfer>> =>
  dataTransferOf(page, {
    name: "sweep.wav",
    type: "audio/wav",
    base64: makeSineSweepWav().toString("base64"),
  });

const textDrop = (page: Page): Promise<JSHandle<DataTransfer>> =>
  dataTransferOf(page, {
    name: "notes.txt",
    type: "text/plain",
    base64: Buffer.from("not audio").toString("base64"),
  });

const overlay = (page: Page) => page.getByTestId("drop-overlay");

test.describe("dropping a file", () => {
  test("raises the overlay while an audio file is over the window", async ({
    page,
  }) => {
    await gotoPlayer(page);
    await expect(overlay(page)).toHaveAttribute("data-active", "false");

    await page
      .locator("body")
      .dispatchEvent("dragenter", { dataTransfer: await audioDrop(page) });

    await expect(overlay(page)).toHaveAttribute("data-active", "true");
    await expect(overlay(page)).toHaveAttribute("data-state", "ready");
  });

  test("opens the dropped audio file", async ({ page }) => {
    await gotoPlayer(page);
    const transfer = await audioDrop(page);

    await page.locator("body").dispatchEvent("dragenter", {
      dataTransfer: transfer,
    });
    await page.locator("body").dispatchEvent("drop", {
      dataTransfer: transfer,
    });

    await expect(page.getByTestId("track-title")).toHaveText("sweep.wav");
    await expect(page.getByTestId("duration")).toHaveText(TRACK_LABEL);
    await expect(overlay(page)).toHaveAttribute("data-active", "false");
  });

  test("refuses a dropped file that is not audio", async ({ page }) => {
    await gotoPlayer(page);
    const transfer = await textDrop(page);

    await page.locator("body").dispatchEvent("dragenter", {
      dataTransfer: transfer,
    });
    await page.locator("body").dispatchEvent("drop", {
      dataTransfer: transfer,
    });

    await expect(overlay(page)).toHaveAttribute("data-state", "rejected");
    await expect(overlay(page)).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("track-title")).toHaveText("No track open");
  });

  test("refuses a non-audio file picked through the chooser", async ({
    page,
  }) => {
    await gotoPlayer(page);

    await pickFile(page, emptyStateOpen(page), {
      ...toPlaywrightFile("notes.txt"),
      mimeType: "text/plain",
      buffer: Buffer.from("not audio"),
    });

    // Next injects its own div[role="alert"] route announcer, so scope to the
    // paragraph the status line renders.
    await expect(page.locator('p[role="alert"]')).toHaveText(
      "Unsupported file: notes.txt",
    );
    await expect(page.getByTestId("track-title")).toHaveText("No track open");
  });
});
