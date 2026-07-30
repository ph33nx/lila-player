"use client";

import { useCallback, useState } from "react";

const COBALT_API_URL = "https://api.cobalt.tools/";

interface CobaltResponse {
  status: "tunnel" | "redirect" | "picker" | "error" | "local-processing";
  url?: string;
  filename?: string;
  error?: { code?: string };
}

const sanitizeFilename = (name: string) => name.replace(/[\\/:*?"<>|]/g, "");

export const useCobaltImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFromUrl = useCallback(
    async (
      sourceUrl: string,
    ): Promise<{ blob: Blob; filename: string } | null> => {
      setIsImporting(true);
      setError(null);

      try {
        const apiResponse = await fetch(COBALT_API_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: sourceUrl,
            downloadMode: "audio",
            audioFormat: "mp3",
            audioBitrate: "320",
          }),
        });

        if (!apiResponse.ok) {
          throw new Error(`Cobalt API error (${apiResponse.status})`);
        }

        const data: CobaltResponse = await apiResponse.json();

        if (data.status === "error") {
          throw new Error(data.error?.code || "Cobalt could not process this link");
        }

        if (
          (data.status === "tunnel" ||
            data.status === "redirect" ||
            data.status === "local-processing") &&
          data.url
        ) {
          const fileResponse = await fetch(data.url);
          if (!fileResponse.ok) {
            throw new Error("Failed to download the resolved audio stream");
          }
          const blob = await fileResponse.blob();
          const filename = sanitizeFilename(
            data.filename || "youtube-audio.mp3",
          );
          return { blob, filename };
        }

        throw new Error(
          "This link returned multiple items. Paste a direct video URL instead.",
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to import from link";
        setError(message);
        return null;
      } finally {
        setIsImporting(false);
      }
    },
    [],
  );

  return { importFromUrl, isImporting, error, setError };
};
