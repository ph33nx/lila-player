"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AudioWaveform from "@/components/audio-waveform";
import DropOverlay from "@/components/drop-overlay";
import AdvancedPanel from "@/components/advanced-panel";
import LoopSection from "@/components/loop-section";
import ParamGrid, { MAIN_PARAMS } from "@/components/param-grid";
import ToneSection from "@/components/tone-section";
import StatusLine from "@/components/status-line";
import ThemeToggle from "@/components/theme-toggle";
import TrackHeader from "@/components/track-header";
import Transport from "@/components/transport";
import WebFaq from "@/components/web-faq";
import { useDesktopShell } from "@/hooks/use-desktop-shell";
import { useFileDrop } from "@/hooks/use-file-drop";
import { usePlayer } from "@/hooks/use-player";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { ACCEPT } from "@/utils/audio-file";

const NOTICE_MS = 4000;

const Home = () => {
  const player = usePlayer();
  const { titleBarStrip } = useDesktopShell();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedName, setSavedName] = useState<string | null>(null);

  const { open, seek, getPosition, exportWav, setLoopStart, setLoopEnd } =
    player;
  const { exporting, error, track } = player;

  const openPicker = useCallback(() => fileInputRef.current?.click(), []);
  const dropState = useFileDrop(open);

  useEffect(() => setSavedName(null), [track]);

  useEffect(() => {
    if (!savedName) return;
    const timer = setTimeout(() => setSavedName(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [savedName]);

  const seekBy = useCallback(
    (seconds: number) => seek(getPosition() + seconds),
    [seek, getPosition],
  );
  const runExport = useCallback(async (): Promise<void> => {
    const name = await exportWav();
    if (name) setSavedName(name);
  }, [exportWav]);
  // Both default their argument to the playhead, so they must be called bare:
  // an onClick handler would hand them the MouseEvent as `seconds`.
  const markStart = useCallback(() => setLoopStart(), [setLoopStart]);
  const markEnd = useCallback(() => setLoopEnd(), [setLoopEnd]);

  useShortcuts({
    togglePlay: player.togglePlay,
    seekBy,
    toggleLoop: player.toggleLoop,
    setLoopStart: markStart,
    setLoopEnd: markEnd,
    open: openPicker,
    exportWav: runExport,
  });

  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset so picking the same file twice still fires a change.
      event.target.value = "";
      if (file) open(file);
    },
    [open],
  );

  return (
    <>
      <div className="flex min-h-screen flex-col">
        {titleBarStrip && (
          <div data-tauri-drag-region className="h-7 shrink-0" />
        )}

        <section className="mx-auto flex w-full max-w-[880px] flex-1 select-none flex-col justify-center gap-3 px-6 py-4 tall:gap-6 tall:px-8 tall:py-8">
          <TrackHeader
            name={track?.name ?? null}
            duration={track?.duration ?? 0}
            isPlaying={player.isPlaying}
            onOpen={openPicker}
            subscribe={player.subscribe}
            getLevel={player.getLevel}
          />

          <AudioWaveform
            track={track}
            loopRegion={player.loopRegion}
            isLoading={player.isLoading}
            isPlaying={player.isPlaying}
            onOpen={openPicker}
            onSeek={seek}
            onTogglePlay={player.togglePlay}
            getPeaks={player.getPeaks}
            subscribe={player.subscribe}
            getPosition={getPosition}
          />

          <div className="space-y-2">
            <Transport
              hasTrack={track !== null}
              isPlaying={player.isPlaying}
              loop={player.params.loop}
              exporting={exporting}
              onTogglePlay={player.togglePlay}
              onToggleLoop={player.toggleLoop}
              onExport={runExport}
            />
            <StatusLine error={error} savedName={savedName} />
          </div>

          <ParamGrid
            specs={MAIN_PARAMS}
            params={player.params}
            onChange={player.setParams}
          />

          <AdvancedPanel>
            <ToneSection params={player.params} onChange={player.setParams} />
            <LoopSection
              region={player.loopRegion}
              hasTrack={track !== null}
              onSetStart={markStart}
              onSetEnd={markEnd}
              onClear={player.clearLoopPoints}
            />
          </AdvancedPanel>
        </section>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      <DropOverlay {...dropState} />
      <ThemeToggle />
      <WebFaq />
    </>
  );
};

export default Home;
