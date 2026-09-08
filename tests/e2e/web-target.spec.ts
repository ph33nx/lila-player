import { expect, test } from "@playwright/test";
import { gotoPlayer } from "./helpers";

const SITE = "https://ph33nx.github.io/lila-player/";
const TITLE =
  "Lila Player: slowed and reverb lofi player for Windows, macOS and Linux";

test.describe("the web target's head", () => {
  test("titles and describes the page", async ({ page }) => {
    await gotoPlayer(page);

    await expect(page).toHaveTitle(TITLE);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /slowed and reverb lofi version, offline\.$/,
    );
  });

  test("points search engines and social cards at the Pages site", async ({
    page,
  }) => {
    await gotoPlayer(page);

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      SITE,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      `${SITE}og.png`,
    );
  });

  test("declares itself as a free SoftwareApplication", async ({ page }) => {
    await gotoPlayer(page);

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    const documents: Record<string, unknown>[] = blocks.map(
      (block) => JSON.parse(block) as Record<string, unknown>,
    );
    const application = documents.find(
      (document) => document["@type"] === "SoftwareApplication",
    );

    expect(application).toBeDefined();
    expect(application).toMatchObject({
      "@context": "https://schema.org",
      name: "Lila Player",
      operatingSystem: "Windows, macOS, Linux",
      isAccessibleForFree: true,
    });
  });
});

test.describe("the web target's static files", () => {
  test("serves llms.txt", async ({ request }) => {
    const response = await request.get("/llms.txt");

    expect(response.status()).toBe(200);
  });

  test("serves the web manifest the head links to", async ({ request }) => {
    const response = await request.get("/site.webmanifest");

    expect(response.status()).toBe(200);
  });
});
