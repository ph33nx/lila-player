/** Hand a blob to the browser as a file download. */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoking in the same task can cancel the download in some engines.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
