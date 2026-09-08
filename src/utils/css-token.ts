/** Read a `--token` from the root element, so canvases paint with the DOM's colours. */
export const readCssToken = (name: string, fallback: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
  fallback;
