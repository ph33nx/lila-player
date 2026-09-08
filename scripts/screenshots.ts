/**
 * Screenshot matrix for the player UI.
 *
 * Serve the static export first, then run this:
 *   npm run build && npx serve out -l 3123 &
 *   node scripts/screenshots.ts [--out <dir>] [--readme]
 *
 * It builds nothing. `--out` defaults to a folder in the OS temp directory;
 * `--readme` writes only the README images (the loop-points state, dark and light) into assets/.
 */
import { chromium, webkit, type Browser, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const BASE_URL = "http://localhost:3123";
const DEFAULT_OUT = path.join(os.tmpdir(), "lila-player-shots");

interface Variant {
  width: number;
  height: number;
  dpr: number;
}

const VARIANTS: Variant[] = [
  { width: 720, height: 480, dpr: 1 },
  { width: 800, height: 600, dpr: 1 },
  { width: 800, height: 600, dpr: 2 },
  { width: 1200, height: 800, dpr: 1 },
  { width: 1200, height: 800, dpr: 2 },
];

const ENGINES = { chromium, webkit } as const;
type EngineName = keyof typeof ENGINES;

const TRACK = "sine-sweep.wav";

/** 3 s stereo 44.1 kHz sine sweep with a slow tremolo, so the waveform has shape. */
const sweepWav = (seconds = 3, rate = 44_100): Buffer => {
  const frames = seconds * rate;
  const bytes = Buffer.alloc(frames * 4);
  let phase = 0;
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    phase += (2 * Math.PI * 110 * Math.pow(8, t / seconds)) / rate;
    const fade = Math.min(1, t * 8, (seconds - t) * 8);
    const tremolo = 0.45 + 0.4 * Math.sin(2 * Math.PI * 1.3 * t);
    const sample = Math.round(Math.sin(phase) * fade * tremolo * 32_000);
    bytes.writeInt16LE(sample, i * 4);
    bytes.writeInt16LE(Math.round(sample * 0.75), i * 4 + 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + bytes.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(bytes.length, 40);
  return Buffer.concat([header, bytes]);
};

const WAV = sweepWav();
/** Long enough that the offline render is still busy when the shot is taken. */
const LONG_WAV = sweepWav(90);
const NOT_AUDIO = Buffer.from("this is not audio\n", "utf8");

const pick = async (
  page: Page,
  trigger: Promise<unknown>,
  file: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  },
): Promise<void> => {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    trigger,
  ]);
  await chooser.setFiles(file);
};

const dragFile = async (
  page: Page,
  name: string,
  type: string,
  drop: boolean,
): Promise<void> => {
  await page.evaluate(
    ({ name, type, drop }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array([1, 2, 3])], name, { type }));
      const fire = (kind: string): void => {
        document.body.dispatchEvent(
          new DragEvent(kind, {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
          }),
        );
      };
      fire("dragenter");
      fire("dragover");
      if (drop) fire("drop");
    },
    { name, type, drop },
  );
};

const seekTo = async (page: Page, ratio: number): Promise<void> => {
  const box = await page.getByTestId("waveform").boundingBox();
  if (!box) throw new Error("waveform has no box");
  await page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2);
};

interface Shooter {
  (name: string): Promise<void>;
}

/** Walks one page through every documented state, shooting as it goes. */
const walk = async (page: Page, shoot: Shooter): Promise<void> => {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await shoot("01-empty");

  await dragFile(page, TRACK, "audio/wav", false);
  await page.waitForTimeout(400);
  await shoot("02-drop-ready");
  await page.evaluate(() =>
    document.body.dispatchEvent(new DragEvent("dragleave", { bubbles: true })),
  );

  await dragFile(page, "notes.txt", "text/plain", true);
  await page.waitForTimeout(300);
  await shoot("03-drop-rejected");
  await page.waitForTimeout(2000);

  await pick(page, page.getByRole("button", { name: "Open audio" }).click(), {
    name: TRACK,
    mimeType: "audio/wav",
    buffer: WAV,
  });
  await page.getByTestId("waveform").waitFor();
  await page.waitForTimeout(300);
  await shoot("04-loaded");

  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(900);
  await shoot("05-playing");

  await page.getByRole("button", { name: "Pause" }).click();
  await page.waitForTimeout(200);
  await shoot("06-paused");

  await page.getByRole("button", { name: "Loop", exact: true }).click();
  await shoot("07-loop-off");
  await page.getByRole("button", { name: "Loop", exact: true }).click();
  await shoot("08-loop-on");

  await page.getByRole("button", { name: "Advanced" }).click();
  await page.waitForTimeout(250);
  await shoot("09-advanced-open");

  await seekTo(page, 0.25);
  await page.getByTestId("set-loop-start").click();
  await seekTo(page, 0.72);
  await page.getByTestId("set-loop-end").click();
  await page.waitForTimeout(150);
  await shoot("10-loop-points");

  // A 3 s render finishes before a screenshot can land, so the export states use
  // a 90 s fixture and the shot waits for aria-busy on the button itself.
  await pick(page, page.getByRole("button", { name: "Open audio" }).click(), {
    name: "long-sweep.wav",
    mimeType: "audio/wav",
    buffer: LONG_WAV,
  });
  await page.getByTestId("waveform").waitFor();
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="duration"]')?.textContent ===
      "1:30",
    null,
    { timeout: 60_000 },
  );

  const exporting = page.getByRole("button", { name: "Export" }).click();
  await page.locator('button[aria-busy="true"]').waitFor({ timeout: 30_000 });
  await shoot("11-exporting");
  await exporting;
  await page
    .getByRole("status")
    .filter({ hasText: "Saved" })
    .waitFor({ timeout: 120_000 });
  await shoot("12-saved");

  await pick(page, page.getByRole("button", { name: "Open audio" }).click(), {
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: NOT_AUDIO,
  });
  await page.locator('p[role="alert"]').waitFor();
  await shoot("13-error");

  // Keyboard-only pass: every stop must show a ring.
  await page.reload({ waitUntil: "networkidle" });
  await pick(page, page.getByRole("button", { name: "Open audio" }).click(), {
    name: TRACK,
    mimeType: "audio/wav",
    buffer: WAV,
  });
  await page.getByTestId("waveform").waitFor();
  for (let stop = 1; stop <= 8; stop++) {
    await page.keyboard.press("Tab");
    await shoot(`14-focus-${stop}`);
  }
};

const run = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outDir = outIndex === -1 ? DEFAULT_OUT : args[outIndex + 1];
  const readmeOnly = args.includes("--readme");

  if (readmeOnly) {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      deviceScaleFactor: 2,
    });
    for (const scheme of ["dark", "light"] as const) {
      const page = await context.newPage();
      await page.emulateMedia({ colorScheme: scheme });
      await walk(page, async (name) => {
        if (name === "10-loop-points") {
          await page.screenshot({
            path: `assets/screenshot-${scheme}.png`,
            fullPage: true,
          });
        }
      });
      await page.close();
    }
    await browser.close();
    console.log(
      "wrote assets/screenshot-dark.png and assets/screenshot-light.png",
    );
    return;
  }

  await mkdir(outDir, { recursive: true });
  const index: string[] = [];

  for (const engineName of Object.keys(ENGINES) as EngineName[]) {
    const browser: Browser = await ENGINES[engineName].launch();
    for (const { width, height, dpr } of VARIANTS) {
      const label = `${engineName}-${width}x${height}@${dpr}x`;
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));

      try {
        await walk(page, async (name) => {
          const file = path.join(outDir, `${label}--${name}.png`);
          await page.screenshot({ path: file });
          index.push(file);
        });
        console.log(`${label}: ok, ${errors.length} page errors`);
      } catch (error) {
        console.error(`${label}: ${(error as Error).message}`);
      }
      if (errors.length > 0) console.error(`${label} errors:`, errors);
      await context.close();
    }
    await browser.close();
  }

  await writeFile(path.join(outDir, "index.txt"), index.join("\n") + "\n");
  console.log(`${index.length} screenshots in ${outDir}`);
};

await run();
