# SpatialData System

A cross-platform desktop application for spatial data visualization and management, built with Tauri 2, React, and Three.js.

## Features

- **CAD File Support**: Parse and render DXF/DWG files with high performance
- **3D Visualization**: Interactive 3D scene editing with Three.js
- **Map Integration**: Support for multiple map providers (MapLibre GL)
- **Component System**: Pluggable component architecture for extensibility
- **Multi-Database Support**: SQLite, DuckDB, PostgreSQL, MySQL, MongoDB
- **Real-time Data**: MQTT integration for live data streaming
- **Cross-Platform**: Runs on macOS, Linux, and Windows

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite 6
- Three.js (3D rendering)
- MapLibre GL (maps)
- ECharts (charts)
- MUI (UI components)
- Zustand (state management)

### Backend
- Tauri 2 (Rust)
- SQLite (bundled)
- DuckDB (bundled)
- acadrust (CAD file parsing)

## Installation

Download the latest release from [GitHub Releases](https://github.com/burrs2916/biosphere-spatialdata-system/releases).

### macOS

The app uses ad-hoc code signing. On first launch, you may need to:

1. Right-click the app and select "Open"
2. Click "Open" in the security dialog
3. Alternatively, go to **System Settings > Privacy & Security** and click "Open Anyway"

No `xattr` commands needed.

### Linux

```bash
chmod +x SpatialData.System*_amd64.AppImage
./SpatialData.System*_amd64.AppImage
```

### Windows

Run the `.msi` or `.exe` installer directly.

## Development

### Prerequisites

- Node.js 20+
- pnpm 8+
- Rust stable

### Setup

```bash
# Install dependencies
pnpm install

# Run development server
pnpm tauri dev

# Build for production
pnpm tauri build
```

### Project Structure

```
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components
│   ├── editor/             # Scene editor
│   ├── datasource/         # Data source adapters
│   └── auth/               # Authentication
├── src-tauri/              # Backend (Rust + Tauri)
│   ├── src/
│   │   ├── commands/       # Tauri commands (API)
│   │   ├── domain/         # Domain models
│   │   ├── infrastructure/ # Database, external services
│   │   └── cad_runtime/    # CAD processing
│   └── Cargo.toml
└── .github/workflows/      # CI/CD
```

## CAD File Support

Supported formats:
- DXF (ASCII and Binary, R12-R2018+)
- DWG (R13-R2018)

Features:
- Entity rendering (lines, arcs, polylines, hatches, text, etc.)
- Layer management
- Block handling
- Spatial indexing for large files
- Custom binary format (.cadbin) for optimized loading

## License

MIT
