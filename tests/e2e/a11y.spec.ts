import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gotoPlayer, openTrack, seekToFraction } from "./helpers";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const scan = (page: Page) => new AxeBuilder({ page }).withTags(WCAG).analyze();

/** Every control visible: track loaded, Advanced open, A and B set. */
const showEverything = async (page: Page): Promise<void> => {
  await openTrack(page);
  await page.getByRole("button", { name: "Advanced" }).click();
  await seekToFraction(page, 0.35);
  await page.getByTestId("set-loop-start").click();
  await seekToFraction(page, 0.83);
  await page.getByTestId("set-loop-end").click();
  await expect(page.getByTestId("loop-start")).toHaveText("0:01");
};

for (const scheme of ["dark", "light"] as const) {
  test.describe(`${scheme} scheme`, () => {
    test.beforeEach(({ page }) => page.emulateMedia({ colorScheme: scheme }));

    test("the empty state has no WCAG A or AA violations", async ({ page }) => {
      await gotoPlayer(page);
      expect((await scan(page)).violations).toEqual([]);
    });

    test("the full player has no WCAG A or AA violations", async ({ page }) => {
      await gotoPlayer(page);
      await showEverything(page);
      expect((await scan(page)).violations).toEqual([]);
    });
  });
}
