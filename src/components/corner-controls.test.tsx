// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const renderCorner = async (target?: string) => {
  if (target !== undefined) vi.stubEnv("NEXT_PUBLIC_TARGET", target);
  vi.resetModules();
  const { default: CornerControls } = await import("./corner-controls");
  const site = await import("@/utils/site");
  render(<CornerControls />);
  return site;
};

describe("CornerControls", () => {
  it("shows only the theme switch in the desktop build", async () => {
    await renderCorner();
    expect(screen.queryByTestId("repo-link")).toBeNull();
    expect(screen.queryByTestId("download-link")).toBeNull();
  });

  it("adds source and download links that open in a new tab on the web", async () => {
    const site = await renderCorner("web");
    const repo = screen.getByTestId("repo-link");
    const download = screen.getByTestId("download-link");

    expect(repo).toHaveProperty("href", site.REPO_URL);
    expect(download).toHaveProperty("href", site.RELEASES_URL);
    for (const link of [repo, download]) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("aria-label")).toBeTruthy();
    }
  });
});
