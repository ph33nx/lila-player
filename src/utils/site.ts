/** Where the project lives, defined once for metadata, structured data and links. */
export const SITE_URL = "https://ph33nx.github.io/lila-player/";
export const REPO_URL = "https://github.com/ph33nx/lila-player";
export const RELEASES_URL = `${REPO_URL}/releases`;

/** The GitHub Pages build sets `NEXT_PUBLIC_TARGET=web`; the desktop build does not. */
export const IS_WEB = process.env.NEXT_PUBLIC_TARGET === "web";
