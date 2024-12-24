# Lila - Slowed and Reverb LoFi Audio Player (Desktop App)

Lila Slow Reverb Player is an audio player desktop app that allows users to play audio files with adjustable playback speed, reverb effects, and vinyl noise overlay. It provides a visual waveform representation of the audio, along with real-time playback progress and time display. Built with Rust and React, the app offers a responsive design for a seamless user experience.

[![Download Lila Player](https://img.shields.io/badge/Download-Lila_Player-blue?style=for-the-badge&logo=github)](https://github.com/ph33nx/lila-player/releases)

![Lila Player Screenshot](./assets/screenshot.png)

## Features

- Play audio files with adjustable speed and pitch.
- Add reverb effects with customizable levels.
- Overlay vinyl noise for an authentic vintage sound.
- Visual waveform display with real-time progress tracking.
- Responsive design for seamless user experience.

## Development

### Prerequisites

1. **Rust Programming Language**:

   - Install Rust using `rustup`, the recommended installer:
     ```bash
     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
     ```
   - After installation, ensure `cargo` (Rust's package manager) is available by running:
     ```bash
     cargo --version
     ```

2. **Node.js and npm**:

   - Download and install Node.js from [Node.js Official Website](https://nodejs.org).
   - Confirm installation by checking the versions:
     ```bash
     node --version
     npm --version
     ```

3. **Tauri CLI**:
   - Install the Tauri CLI for building the desktop application:
     ```bash
     cargo install tauri-cli
     ```
   - Verify installation:
     ```bash
     tauri --version
     ```

### Setup Development Environment

1. Clone the repository:

   ```bash
   git clone https://github.com/ph33nx/lila-player
   cd lila-player
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Tauri v2 Instructions

1. Ensure you have Tauri CLI installed:

   ```bash
   cargo install tauri-cli
   ```

2. Build the Tauri application:

   ```bash
   npm run tauri build
   ```

3. Start the Tauri development environment:

   ```bash
   npm run tauri dev
   ```
