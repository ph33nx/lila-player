import { expect, test } from "@playwright/test";
import { gotoPlayer, loopButton, openTrack, slider } from "./helpers";

interface Control {
  /** Accessible name of the thumb, which is the element with role="slider". */
  name: string;
  testId: string;
  min: string;
  max: string;
  /** What DEFAULT_PARAMS puts on the readout. */
  fallback: string;
  /** One wheel notch up from the default, then five more with Shift held. */
  up: string;
  shiftUp: string;
  /** The Tone group lives under Advanced, which has to be opened first. */
  advanced?: boolean;
}

const tone = (name: string, key: string): Control => ({
  name,
  testId: `value-${key}`,
  min: "0%",
  max: "100%",
  fallback: "0%",
  up: "1%",
  shiftUp: "6%",
  advanced: true,
});

const CONTROLS: readonly Control[] = [
  {
    name: "Volume",
    testId: "value-volume",
    min: "0%",
    max: "110%",
    fallback: "85%",
    up: "86%",
    shiftUp: "91%",
  },
  {
    name: "Speed",
    testId: "value-speed",
    min: "0.65x",
    max: "1.35x",
    fallback: "0.85x",
    up: "0.90x",
    shiftUp: "1.15x",
  },
  {
    name: "Reverb",
    testId: "value-reverb",
    min: "0%",
    max: "100%",
    fallback: "40%",
    up: "41%",
    shiftUp: "46%",
  },
  {
    name: "Vinyl crackle",
    testId: "value-vinyl",
    min: "0%",
    max: "100%",
    fallback: "50%",
    up: "51%",
    shiftUp: "56%",
  },
  tone("Bass", "bass"),
  tone("Warmth", "warmth"),
  tone("Drive", "drive"),
  tone("Wobble", "wobble"),
];

test.describe("the parameter sliders", () => {
  test.beforeEach(async ({ page }) => {
    await gotoPlayer(page);
    await openTrack(page);
  });

  for (const control of CONTROLS) {
    const { name, testId, min, max, fallback, up, shiftUp, advanced } = control;

    test.describe(name, () => {
      test.beforeEach(async ({ page }) => {
        if (advanced)
          await page.getByRole("button", { name: "Advanced" }).click();
      });

      test(`${name} reaches its maximum in one End press`, async ({ page }) => {
        await slider(page, name).press("End");

        await expect(page.getByTestId(testId)).toHaveText(max);
      });

      test(`${name} reaches its minimum in one Home press`, async ({
        page,
      }) => {
        await slider(page, name).press("Home");

        await expect(page.getByTestId(testId)).toHaveText(min);
      });

      test(`${name} moves a step per wheel notch, five with Shift`, async ({
        page,
      }) => {
        await slider(page, name).hover();
        await page.mouse.wheel(0, -100);
        await expect(page.getByTestId(testId)).toHaveText(up);

        await page.keyboard.down("Shift");
        await page.mouse.wheel(0, -100);
        await page.keyboard.up("Shift");
        await expect(page.getByTestId(testId)).toHaveText(shiftUp);
      });

      test(`${name} returns to its default on a double-click`, async ({
        page,
      }) => {
        await slider(page, name).press("End");
        await expect(page.getByTestId(testId)).toHaveText(max);

        await slider(page, name).dblclick();

        await expect(page.getByTestId(testId)).toHaveText(fallback);
      });
    });
  }

  test("Loop reports its state through aria-pressed", async ({ page }) => {
    await expect(loopButton(page)).toHaveAttribute("aria-pressed", "true");

    await loopButton(page).click();
    await expect(loopButton(page)).toHaveAttribute("aria-pressed", "false");

    await loopButton(page).click();
    await expect(loopButton(page)).toHaveAttribute("aria-pressed", "true");
  });
});
