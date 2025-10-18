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

1. **[Tauri dependencies](https://v2.tauri.app/start/prerequisites/)**

2. **[Node.js](https://nodejs.org/en/download) and [pnpm](https://pnpm.io/installation)**

### Setup Development Environment

1. Clone the repository:

   ```bash
   git clone https://github.com/ph33nx/lila-player
   cd lila-player
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the app in development mode:

   ```bash
   pnpm tauri dev
   ```

4. Build the app for production:

   ```bash
   pnpm tauri build
   ```

## Building for Distribution

### Linux Platforms

#### AppImage (Universal Linux Package)

AppImage creates a portable application that runs on most Linux distributions without installation.

**Prerequisites:**
```bash
# Install libfuse2 (required for AppImage)
sudo apt install libfuse2  # Ubuntu/Debian
sudo dnf install fuse-libs  # Fedora/RHEL
```

**Build AppImage:**
```bash
pnpm tauri build -- --target appimage
```

The AppImage will be generated in `src-tauri/target/release/bundle/appimage/`

#### Debian Package (.deb)

**Prerequisites:**
```bash
sudo apt install dpkg
```

**Build Debian Package:**
```bash
pnpm tauri build -- --target deb
```

The .deb package will be generated in `src-tauri/target/release/bundle/deb/`

#### RPM Package (.rpm)

**Prerequisites:**
```bash
sudo dnf install rpm-build  # Fedora/RHEL
```

**Build RPM Package:**
```bash
pnpm tauri build -- --target rpm
```

The .rpm package will be generated in `src-tauri/target/release/bundle/rpm/`

#### Snap Package (.snap)

**Prerequisites:**
```bash
sudo snap install snapcraft --classic
```

**Build Snap Package:**
```bash
pnpm tauri build -- --target snap
```

The .snap package will be generated in `src-tauri/target/release/bundle/snap/`

### Cross-Platform Building

To build for multiple targets at once:

```bash
# Build all Linux formats
pnpm tauri build -- --target all

# Build specific targets
pnpm tauri build -- --target appimage,deb,rpm
```

### Package Management

#### Updating Dependencies

Use the included script to update all dependencies:

```bash
# Update all packages to latest versions
pnpm run update:packages

# Or manually update specific packages
pnpm update
```

#### Development Scripts

```bash
# Development with hot reload
pnpm dev

# Build for production
pnpm build

# Run linting
pnpm lint

# Format code
pnpm format

# Tauri development
pnpm tauri dev

# Tauri build
pnpm tauri build
```
