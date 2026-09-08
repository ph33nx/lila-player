import { expect, test, type Page } from "@playwright/test";
import { gotoPlayer } from "./helpers";

const root = (page: Page) => page.locator("html");
const toggle = (page: Page) => page.getByTestId("theme-toggle");

test.describe("theme", () => {
  test("follows the device scheme until a choice is made", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoPlayer(page);
    await expect(root(page)).toHaveClass(/\bdark\b/);
    await expect(toggle(page)).toHaveAttribute("data-resolved", "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(root(page)).not.toHaveClass(/\bdark\b/);
    await expect(toggle(page)).toHaveAttribute("data-resolved", "light");
  });

  test("switches between light and dark and remembers the choice across a reload", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoPlayer(page);

    await toggle(page).click();
    await expect(root(page)).not.toHaveClass(/\bdark\b/);
    await expect(toggle(page)).toHaveAttribute("data-resolved", "light");

    await page.reload();
    await expect(toggle(page)).toHaveAttribute("data-resolved", "light");
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(
      "light",
    );

    await toggle(page).click();
    await expect(root(page)).toHaveClass(/\bdark\b/);
    await expect(toggle(page)).toHaveAttribute("data-resolved", "dark");
  });
});
