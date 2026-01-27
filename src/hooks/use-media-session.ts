"use client";

import { useEffect } from "react";

interface MediaSessionOptions {
  title?: string;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
}

export const useMediaSession = ({
  title,
  isPlaying,
  onPlay,
  onPause,
}: MediaSessionOptions) => {
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || "Lila Player",
      artist: "Slowed + Reverb",
      album: "Lila Player",
    });

    navigator.mediaSession.setActionHandler("play", onPlay);
    navigator.mediaSession.setActionHandler("pause", onPause);

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [title, onPlay, onPause]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);
};
