"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as Tone from "tone";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { motion } from "framer-motion";
import { Play, Pause, Save } from "lucide-react";
import AudioWaveform from "@/components/audio-waveform";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const [currentPlayer, setCurrentPlayer] = useState<Tone.Player | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [progress, setProgress] = useState(0);
  const [vinylPlayer, setVinylPlayer] = useState<Tone.Player | null>(null);
  const [reverb, setReverb] = useState<Tone.Reverb | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(100);
  const [speed, setSpeed] = useState(1);
  const [reverbLevel, setReverbLevel] = useState(0);
  const [vinylNoiseLevel, setVinylNoiseLevel] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // Initialize vinyl noise player
  useEffect(() => {
    const setupVinylNoise = async () => {
      try {
        const vinyl = new Tone.Player("/vinyl-noise.mp3").toDestination();
        await Tone.loaded();
        vinyl.loop = true;
        vinyl.volume.value = -Infinity; // Start muted
        setVinylPlayer(vinyl);
      } catch (error) {
        console.error("Error loading vinyl noise:", error);
      }
    };
    setupVinylNoise();

    // Cleanup
    return () => {
      vinylPlayer?.dispose();
    };
  }, []);

  // Update progress and time
  useEffect(() => {
    if (!currentPlayer || !currentPlayer.buffer) return;

    const interval = setInterval(() => {
      if (currentPlayer.state === "started" && startTimeRef.current !== null) {
        const now = Tone.now();
        const playbackRate = currentPlayer.playbackRate || 1;
        const currentTime = (now - startTimeRef.current) * playbackRate;
        const bufferDuration = currentPlayer.buffer.duration || 1;

        const newProgress = Math.max(
          0,
          Math.min(currentTime / bufferDuration, 1)
        );
        setProgress(newProgress);

        // Stop the player when the progress reaches the end
        if (newProgress >= 1) {
          currentPlayer.stop();
          vinylPlayer?.stop();
          setIsPlaying(false);
          startTimeRef.current = null;
        }
      }
    }, 500); // Check every half-second for smoother updates

    return () => clearInterval(interval);
  }, [currentPlayer]);

  // Apply audio settings when player changes
  useEffect(() => {
    if (!currentPlayer) return;

    // Apply current settings to new audio
    currentPlayer.playbackRate = speed;
    currentPlayer.volume.value = volume - 100;

    if (reverbLevel > 0) {
      const newReverb = new Tone.Reverb({
        decay: (reverbLevel / 100) * 10,
        wet: reverbLevel / 100,
      }).toDestination();

      currentPlayer.disconnect();
      currentPlayer.connect(newReverb);
      setReverb(newReverb);
    }

    if (vinylNoiseLevel > 0 && vinylPlayer) {
      vinylPlayer.volume.value = vinylNoiseLevel - 100;
    }
  }, [currentPlayer]);

  useEffect(() => {
    if (!currentPlayer) {
      setProgress(0);
      startTimeRef.current = null;
    }
  }, [currentPlayer]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      try {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);

        // Clean up previous instances
        currentPlayer?.dispose();
        reverb?.dispose();

        const url = URL.createObjectURL(file);
        const player = new Tone.Player(url).toDestination();
        await Tone.loaded();

        // Store the audio buffer for waveform visualization
        setAudioBuffer(player.buffer.get() as AudioBuffer);
        setCurrentPlayer(player);
        setProgress(0);
        setIsPlaying(false);
      } catch (error) {
        console.error("Error loading audio file:", error);
        // Reset player state on error
        setCurrentPlayer(null);
        setAudioBuffer(null);
        setProgress(0);
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    },
    [currentPlayer, reverb]
  );

  const handlePlayPause = useCallback(async () => {
    try {
      await Tone.start();
      if (!currentPlayer) return;

      if (currentPlayer.state === "started") {
        currentPlayer.stop();
        vinylPlayer?.stop();
        setIsPlaying(false);
        startTimeRef.current = null; // Reset start time
      } else {
        startTimeRef.current = Tone.now(); // Store the start time
        currentPlayer.start();
        if (vinylPlayer && vinylPlayer.volume.value > -Infinity) {
          vinylPlayer.start();
        }
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Error playing/pausing audio:", error);
    }
  }, [currentPlayer, vinylPlayer]);

  const handleSpeedChange = useCallback(
    (values: number[]) => {
      try {
        const speed = values[0];
        setSpeed(speed);
        if (currentPlayer) {
          currentPlayer.playbackRate = speed;
        }
      } catch (error) {
        console.error("Error changing speed:", error);
      }
    },
    [currentPlayer]
  );

  const handleVolumeChange = useCallback(
    (values: number[]) => {
      try {
        const vol = values[0];
        setVolume(vol);
        if (currentPlayer) {
          currentPlayer.volume.value = vol - 100; // Boost volume above 100
        }
      } catch (error) {
        console.error("Error changing volume:", error);
      }
    },
    [currentPlayer]
  );

  const handleReverbChange = useCallback(
    (values: number[]) => {
      try {
        const level = values[0];
        setReverbLevel(level);
        const reverbLevel = level / 100;
        if (!currentPlayer) return;

        // Clean up previous reverb
        reverb?.dispose();

        if (reverbLevel > 0) {
          const newReverb = new Tone.Reverb({
            decay: reverbLevel * 10,
            wet: reverbLevel,
          }).toDestination();

          // Adjust dry/wet mix to prevent audio crackling
          currentPlayer.disconnect();
          currentPlayer.connect(newReverb);
          setReverb(newReverb);
        } else {
          currentPlayer.disconnect();
          currentPlayer.toDestination();
        }
      } catch (error) {
        console.error("Error changing reverb:", error);
      }
    },
    [currentPlayer, reverb]
  );

  const handleVinylNoiseChange = useCallback(
    (values: number[]) => {
      try {
        const level = values[0];
        setVinylNoiseLevel(level);
        if (vinylPlayer) {
          vinylPlayer.volume.value = level === 0 ? -Infinity : level - 100;
          if (level > 0 && currentPlayer?.state === "started") {
            vinylPlayer.start();
          } else {
            vinylPlayer.stop();
          }
        }
      } catch (error) {
        console.error("Error changing vinyl noise:", error);
      }
    },
    [vinylPlayer, currentPlayer]
  );

  const handleProgressClick = useCallback(
    (newProgress: number) => {
      try {
        if (currentPlayer && currentPlayer.buffer) {
          const wasPlaying = currentPlayer.state === "started";
          const newTime = newProgress * currentPlayer.buffer.duration;

          currentPlayer.stop();
          setProgress(newProgress); // Update progress immediately for smoother UI

          if (wasPlaying) {
            currentPlayer.start("+0.1", newTime);
            setIsPlaying(true);
          } else {
            currentPlayer.start().stop("+0.1"); // Seek without playing
            setIsPlaying(false);
          }
        }
      } catch (error) {
        console.error("Error seeking audio:", error);
      }
    },
    [currentPlayer]
  );

  const float32ToUint8 = (float32Array: Float32Array): Uint8Array => {
    const uint8Array = new Uint8Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Normalize the values to fit in the range 0-255
      uint8Array[i] = Math.min(
        255,
        Math.max(0, ((float32Array[i] + 1) / 2) * 255) // Map from [-1, 1] to [0, 255]
      );
    }
    return uint8Array;
  };

  const handleSave = useCallback(async () => {
    try {
      if (!currentPlayer || !currentPlayer.buffer) return;

      const filePath = await save({
        filters: [
          {
            name: "Audio",
            extensions: ["mp3"],
          },
        ],
      });

      if (filePath) {
        const buffer = currentPlayer.buffer;
        const audioData = buffer.getChannelData(0); // Float32Array
        const uint8Data = float32ToUint8(audioData); // Convert to Uint8Array
        await writeFile(filePath, uint8Data, {
          baseDir: BaseDirectory.Desktop,
        }); // Use a valid directory
      }
    } catch (error) {
      console.error("Error saving audio:", error);
    }
  }, [currentPlayer]);

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="w-full max-w-4xl bg-card p-8 rounded-lg"
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h1 className="text-3xl font-bold mb-6 text-center">Lila Player</h1>
        <Input
          type="file"
          accept=".mp3,.wav,.flac"
          className="mb-6"
          onChange={handleFileChange}
        />
        <AudioWaveform
          buffer={audioBuffer}
          progress={progress}
          onProgressClick={handleProgressClick}
          isLoading={isLoading}
        />
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div>
            <label className="block mb-2">Volume</label>
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              min={0}
              max={150} // Allow volume up to 150%
              step={1}
              className={`${volume > 100 ? "bg-red-500" : "bg-primary"}`}
            />
          </div>
          <div>
            <label className="block mb-2">Speed & Pitch</label>
            <Slider
              value={[speed]}
              onValueChange={handleSpeedChange}
              min={0.5}
              max={2}
              step={0.1}
            />
          </div>
          <div>
            <label className="block mb-2">Reverb Level</label>
            <Slider
              value={[reverbLevel]}
              onValueChange={handleReverbChange}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <div>
            <label className="block mb-2">Vinyl Noise</label>
            <Slider
              value={[vinylNoiseLevel]}
              onValueChange={handleVinylNoiseChange}
              min={0}
              max={100}
              step={1}
            />
          </div>
        </div>
        <div className="flex justify-center gap-4 mt-6">
          <Button onClick={handlePlayPause} className="w-32">
            {isPlaying ? <Pause className="mr-2" /> : <Play className="mr-2" />}
            {isPlaying ? "Pause" : "Play"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!currentPlayer}
            className="w-32"
          >
            <Save className="mr-2" />
            Save
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
