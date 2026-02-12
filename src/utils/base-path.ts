/**
 * Get the base path for the app
 * This is set during build time by PAGES_BASE_PATH env var (GitHub Actions)
 * Falls back to detecting from the current path
 */
const BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH || process.env.__NEXT_ROUTER_BASEPATH || "";

/**
 * Prepend the base path to a static asset URL
 * Use this for runtime asset loading (Audio, fetch, etc.)
 */
export function withBasePath(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalizedPath}`;
}
