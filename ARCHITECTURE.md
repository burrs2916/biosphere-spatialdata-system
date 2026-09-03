# Architecture — biosphere-spatialdata-system

## Overview

A Tauri 2 desktop application for spatial data visualization. Combines a CAD viewer (DWG/DXF), interactive map engine (MapLibre GL), data pipeline (multi-database + MQTT + WebSocket), and a visual component editor with real-time data binding.

**Tech stack**: React 18 + TypeScript 5.6 + Vite 6 + Zustand + Three.js + Konva + MapLibre GL + ECharts + Tauri 2 (Rust backend).

## High-Level Structure

```
src/
├── auth/               Authentication state & presets
├── components/         Shared UI components (layout, widgets, icons)
│   └── layout/         App shell, navigation, settings drawer
├── datasource/         Data pipeline: adapters, orchestration, scheduling
│   ├── adapters/       Database/MQTT/WebSocket/HTTP connectors
│   ├── orchestration/  DataOrchestrator — coordinates data flow
│   ├── pipeline/       DataPipeline — transform & route
│   └── scheduler/      Periodic refresh scheduling
├── devices/            Device integration (EdgeConductor IoT)
├── editor/             Visual editor — the core application
│   ├── cad/            CAD viewer engine (DWG/DXF rendering)
│   ├── canvas/         Component canvas (drag/drop/resize)
│   ├── hooks/          15 custom hooks for editor state
│   ├── layers/         Layer management panel
│   ├── map-engines/    MapLibre GL integration
│   ├── panels/         Editor UI panels (properties, components, devices)
│   ├── plugins/        Plugin loader system
│   ├── renderers/      72 component renderers (DataV, device variants)
│   ├── spatial/        Spatial query & geometry utilities
│   └── tools/          Editor tools (measure, annotate)
├── hooks/              Global hooks (router, theme, responsive)
├── pages/              Route pages (MapEditor, MapLibrary, ComponentManagement)
├── services/           Tauri IPC bridge, API clients
├── store/              Zustand stores (editor, auth, component, datasource, device)
├── theme/              MUI theme configuration
├── types/              Shared TypeScript types & interfaces
└── utils/              Utility functions (geometry, color, validation)
```

## Module Boundaries

### CAD Viewer Engine (`editor/cad/`)

The CAD viewer is a self-contained rendering subsystem. Entry point: `CadViewerEngine.ts` (facade for external consumers).

```
cad/
├── CadViewerEngine.ts      Public API: load, camera, selection, layers, events
├── CadRenderer.ts          Thin Facade coordinating 7 modules
├── rendering/              Extracted modules (7 files, ~5050 lines)
│   ├── SceneManager.ts         Three.js scene, renderer, canvas, picking
│   ├── CameraController.ts     OrthographicCamera: zoom, pan, fitToView
│   ├── EntityStore.ts          Entity CRUD, layer index, color management
│   ├── SelectionManager.ts     Selection, highlight, GPU picking
│   ├── ViewportCuller.ts       Throttled viewport culling
│   ├── GeometryFactory.ts      Mesh creation, color resolution, text, hatch
│   ├── InteractionController.ts Mouse/keyboard events, box select, drawing
│   └── index.ts               Barrel exports
├── cad_runtime/            Shared runtime (scene graph, spatial index, SDF text)
│   ├── scene_graph.ts          SceneGraph builder from CAD entities
│   ├── scene_node.ts           SceneNode types (line, circle, arc, text, etc.)
│   ├── grid_spatial_index.ts   Grid-based spatial indexing
│   ├── sdf_text_renderer.ts    SDF text batched rendering (troika-three-text)
│   ├── batched_layer_builder.ts Batched line geometry rendering
│   ├── cadbin_reader.ts        Binary CAD file reader
│   └── entity_renderers/       Pluggable entity renderer registry
├── coordinate/             Coordinate transform calculator
├── drawing/                Drawing manager (line, circle, text tools)
├── measure/                Measurement tool
├── snap/                   Snap-to-entity manager
└── tools/                  Tool interface definitions
```

**Data flow**: DXF/DWG file → Rust `acadrust` parser → `CadbinReader` → `SceneGraph` → `CadRenderer` (7 modules) → Three.js WebGL canvas.

### Data Pipeline (`datasource/`)

```
datasource/
├── adapters/         7 database adapters (SQLite, DuckDB, PostgreSQL, MySQL, MongoDB, GreptimeDB, HTTP)
├── orchestration/    DataOrchestrator — manages active connections & refresh cycles
├── pipeline/         DataPipeline — transforms raw query results into typed DataFrames
├── scheduler/        Periodic refresh with configurable intervals
├── dataframe.ts      DataFrame type: columns + typed arrays
├── binding/          Data binding expressions (template → value)
└── template/         Query template engine
```

### Component Editor (`editor/`)

The editor uses a registry pattern: all component types (basic, chart, map, decoration, device) are registered in `registry.ts` with their config schemas and lazy-loaded renderers.

```
registry.ts → componentRegistry (singleton)
            → registerBuiltinComponents()
                → registerBasicComponents()      [text, image, shape, echart, metric, video]
                → registerMapComponents()        [map-tile, map-cad, map-blueprint, map-globe, map-heatmap]
                → registerDecorationComponents() [decoration-*, title-*, datav-*]
                → registerDeviceComponents()     [dynamic, from ProductDefinition API]
```

### Renderers (`editor/renderers/`)

72 files implementing visual renderers for each component type. Largest subdirectories:

- `deviceVariants/` (9 files) — SVG-based IoT device renderers (sensors, controllers, pins)
- `decorPaths/` — Decoration SVG path generators

### State Management (`store/`)

6 Zustand stores with Immer middleware:

| Store | Lines | Purpose |
|-------|-------|---------|
| `editorStore` | 1213 | Editor state: components, layers, selection, history |
| `authStore` | 1313 | Authentication config, token management, presets |
| `componentStore` | 774 | Component definitions, drag state, clipboard |
| `datasourceStore` | 680 | Data source configs, connection state, query results |
| `deviceStore` | — | Device registry, live status, mapping |
| `themeStore` | — | Theme, appearance, icon groups |

## Key Design Decisions

- **Tauri IPC**: All file I/O, database access, and network requests go through `services/tauri.ts` which wraps Tauri command invocations. No direct fetch/file access in the frontend.
- **Lazy rendering**: Component renderers are loaded on demand via `lazy()` helper to keep initial bundle small.
- **CAD rendering isolation**: The CAD viewer has zero dependencies on React or Zustand — it's a pure Three.js subsystem. `CadViewerEngine` is the only bridge to React.
- **Spatial index**: Grid-based spatial index (`GridSpatialIndex`) for O(1) viewport culling and hit testing on large CAD drawings.
- **SDF text**: Uses `troika-three-text` for GPU-efficient text rendering with batched sync.

## Testing

- **Framework**: Vitest + @testing-library/react
- **Config**: `vitest.config.ts`
- **Run**: `npm test` (single run), `npm run test:watch` (watch mode)
- **Coverage**: `npm run test:coverage` (V8 provider)

## Linting & Formatting

- **ESLint**: Flat config (`eslint.config.js`) with TypeScript + React Hooks + React Refresh
- **Prettier**: `.prettierrc` — single quotes, 120 char width, trailing commas
- **Run**: `npm run lint`, `npm run format`

## Build

```bash
npm run dev          # Vite dev server
npm run build        # tsc + vite build
npm run tauri dev    # Tauri dev mode (Rust + Vite)
npm run tauri build  # Production build
```
