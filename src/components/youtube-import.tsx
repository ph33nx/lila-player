"use client";

import { useState, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { Link2, Loader2, ArrowRight } from "lucide-react";
import { useCobaltImport } from "@/hooks/use-cobalt";

interface YoutubeImportProps {
  onImported: (blob: Blob, filename: string) => void;
}

function YoutubeImport({ onImported }: YoutubeImportProps) {
  const [url, setUrl] = useState("");
  const { importFromUrl, isImporting, error } = useCobaltImport();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!url.trim() || isImporting) return;

      const result = await importFromUrl(url.trim());
      if (result) {
        onImported(result.blob, result.filename);
        setUrl("");
      }
    },
    [url, isImporting, importFromUrl, onImported],
  );

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 w-full rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 focus-within:border-white/25 transition-colors"
      >
        <Link2 className="h-4 w-4 text-white/40 shrink-0" />
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube link to slow it down..."
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/30 min-w-0"
          disabled={isImporting}
        />
        <button
          type="submit"
          disabled={!url.trim() || isImporting}
          className="shrink-0 h-7 w-7 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity cursor-pointer"
          title="Import from link"
        >
          {isImporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
        </button>
      </form>
      {error && <p className="text-xs text-red-400/80 mt-1.5 px-2">{error}</p>}
      <p className="text-[11px] text-white/30 mt-1.5 px-2">
        Powered by the cobalt API, audio is fetched directly in your browser.
      </p>
    </motion.div>
  );
}

export default memo(YoutubeImport);
