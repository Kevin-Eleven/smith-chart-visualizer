# AGENTS

## Quick Commands
- Install: `npm install`
- Dev server: `npm run dev` (Vite, port 8080 in `vite.config.ts`)
- Build: `npm run build` (or `npm run build:dev` for dev mode)
- Lint: `npm run lint`
- Unit tests: `npm run test` (Vitest)
- Watch tests: `npm run test:watch`

## App Entry Points
- HTML entry: `index.html` mounts to `#root` and loads `src/main.tsx`.
- React entry: `src/main.tsx` renders `src/App.tsx`.
- Routing: `src/App.tsx` uses React Router; `/` -> `src/pages/Index.tsx`, `*` -> `src/pages/NotFound.tsx`.

## Project Structure (What Lives Where)
- Smith chart core logic lives in `src/smith/`:
  - `src/smith/math.ts` defines `Complex` and all RF/Smith math helpers.
  - `src/smith/state.ts` defines `SmithState`, history, localStorage persistence, and point metadata.
  - `src/smith/renderer.ts` is the canvas renderer for the chart grid, points, and overlays.
- UI/UX panels and layout are in `src/components/` (e.g., `SmithCanvas`, panels, status bar).
- Page-level composition and app behavior live in `src/pages/Index.tsx` (state wiring, handlers, keyboard shortcuts).

## Conventions & Wiring Notes
- Path alias `@/*` resolves to `src/*` (Vite + TS config).
- State persistence uses localStorage keys: `smithChart_state` and `smithChart_theme` (see `src/smith/state.ts`).
