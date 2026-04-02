# Smith-chart-playground

An interactive **Smith Chart** web app built with **React + Vite + TypeScript**.

## 🚀 What is this?

Smith-chart-playground lets you explore impedance/admittance transformations using a classic Smith chart visualization.

### ✅ Features

- Interactive Smith chart plotting (click to plot points)
- Impedance / admittance mode toggle (Z / Y / ZY)
- Point list with rename/delete
- Solution log tracking all steps and moves
- Undo/redo history navigation
- Export the chart as a PNG image
- Light/dark theme support
- Responsive layout with keyboard shortcuts

## 🧭 How to Use

1. Run the app locally (see below).
2. Click anywhere on the Smith chart to plot a point.
3. Use the **Input** panel to enter known values and navigate along transmission lines.
4. Switch between **Impedance**, **Admittance**, and **Combined** modes.
5. Track plotted points in the **Points** tab and review the **Solution Log**.
6. Export the current chart as a PNG from the **Settings** tab.

## 🛠️ Local Development

```bash
npm install
npm run dev
```

Then open the URL shown in your terminal (usually `http://localhost:5173`).

## ✅ Available Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Starts the dev server (Vite)         |
| `npm run build`      | Builds the production bundle         |
| `npm run build:dev`  | Builds with `development` mode       |
| `npm run preview`    | Preview the production build locally |
| `npm run lint`       | Run ESLint checks                    |
| `npm run test`       | Run unit tests (Vitest)              |
| `npm run test:watch` | Run tests in watch mode              |

## 🧩 Project Structure

- `src/` – Main source code
  - `pages/` – App pages (root page + 404)
  - `components/` – Reusable UI components (chart, panels, layout)
  - `smith/` – Smith-chart math, state management, and rendering logic
  - `hooks/` – Custom React hooks
  - `lib/` – Utility functions

## 🧠 Notes

- The core Smith-chart math lives in `src/smith/math.ts`.
- State history (undo/redo) is implemented via `StateHistory` in `src/smith/state.ts`.
