import React from "react";
import type {
  SmithState,
  DisplaySettings,
  PointHighlightSettings,
  SmithPoint,
} from "@/smith/state";

interface Props {
  state: SmithState;
  selectedPoint: SmithPoint | null;
  onUpdateDisplay: (updates: Partial<DisplaySettings>) => void;
  onUpdateSelectedPointHighlights: (
    updates: Partial<PointHighlightSettings>,
  ) => void;
  onUpdateZ0: (z0: number) => void;
  onUpdateFrequency: (freq: number | null, unit: "MHz" | "GHz") => void;
  onExportPNG: () => void;
}

export default function SettingsPanel({
  state,
  selectedPoint,
  onUpdateDisplay,
  onUpdateSelectedPointHighlights,
  onUpdateZ0,
  onUpdateFrequency,
  onExportPNG,
}: Props) {
  const toggle = (key: keyof DisplaySettings) => {
    const val = state.display[key];
    if (typeof val === "boolean") {
      onUpdateDisplay({ [key]: !val });
    }
  };

  const checkboxRow = (key: keyof DisplaySettings, label: string) => {
    const val = state.display[key];
    if (typeof val !== "boolean") return null;
    return (
      <label
        key={key}
        className="flex items-center gap-2 cursor-pointer text-sm py-0.5"
      >
        <input
          type="checkbox"
          checked={val}
          onChange={() => toggle(key)}
          className="rounded border-input accent-primary"
        />
        <span className="text-foreground">{label}</span>
      </label>
    );
  };

  const pointCheckboxRow = (
    key: keyof PointHighlightSettings,
    label: string,
  ) => {
    const val = selectedPoint?.highlightSettings[key];
    if (typeof val !== "boolean") return null;

    return (
      <label
        key={key}
        className="flex items-center gap-2 cursor-pointer text-sm py-0.5"
      >
        <input
          type="checkbox"
          checked={val}
          onChange={() => onUpdateSelectedPointHighlights({ [key]: !val })}
          className="rounded border-input accent-primary"
          disabled={!selectedPoint}
        />
        <span className="text-foreground">{label}</span>
      </label>
    );
  };

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* Reference impedance */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">
          Reference Impedance
        </label>
        <div className="flex items-center gap-2">
          <input
            className="smith-input w-24"
            type="number"
            value={state.Z0}
            onChange={(e) => onUpdateZ0(parseFloat(e.target.value) || 1)}
          />
          <span className="text-muted-foreground">Ω</span>
        </div>
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">
          Frequency (optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            className="smith-input w-24"
            type="number"
            value={state.frequency ?? ""}
            placeholder="—"
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onUpdateFrequency(isNaN(v) ? null : v, state.frequencyUnit);
            }}
          />
          <select
            className="smith-input py-1.5"
            value={state.frequencyUnit}
            onChange={(e) =>
              onUpdateFrequency(
                state.frequency,
                e.target.value as "MHz" | "GHz",
              )
            }
          >
            <option value="MHz">MHz</option>
            <option value="GHz">GHz</option>
          </select>
        </div>
      </div>

      {/* Display options */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
          Chart Display
        </label>
        <div className="space-y-0.5">
          {checkboxRow("showResistanceCircles", "Resistance circles")}
          {checkboxRow("showReactanceArcs", "Reactance arcs")}
          {checkboxRow("showConductanceCircles", "Conductance circles")}
          {checkboxRow("showSusceptanceArcs", "Susceptance arcs")}
          {checkboxRow("showOuterScales", "Outer wavelength scales")}
          {checkboxRow("showQCircles", "Q circles")}
          {checkboxRow("showPath", "Show path between points")}
          {checkboxRow("gridSnap", "Grid snap")}
        </div>
      </div>

      {/* Active point highlights */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
          Selected Point Highlights
        </label>
        {selectedPoint ? (
          <>
            <p className="text-xs text-muted-foreground mb-1.5">
              Editing: {selectedPoint.label}
            </p>
            <div className="space-y-0.5">
              {pointCheckboxRow("showVswrCircle", "VSWR circle")}
              {pointCheckboxRow("showRCircle", "Constant-r circle")}
              {pointCheckboxRow("showXArc", "Constant-x arc")}
              {pointCheckboxRow("showGCircle", "Constant-g circle")}
              {pointCheckboxRow("showBArc", "Constant-b arc")}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                className="smith-btn text-xs flex-1"
                onClick={() =>
                  onUpdateSelectedPointHighlights({
                    showRCircle: true,
                    showXArc: true,
                    showGCircle: false,
                    showBArc: false,
                  })
                }
              >
                All R
              </button>
              <button
                className="smith-btn text-xs flex-1"
                onClick={() =>
                  onUpdateSelectedPointHighlights({
                    showRCircle: false,
                    showXArc: false,
                    showGCircle: true,
                    showBArc: true,
                  })
                }
              >
                All Y
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Select a point in the Points tab to edit its highlight circles.
          </p>
        )}
      </div>

      {/* Q values */}
      {state.display.showQCircles && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">
            Q Values
          </label>
          <input
            className="smith-input w-full"
            value={state.display.qValues.join(", ")}
            onChange={(e) => {
              const vals = e.target.value
                .split(",")
                .map((s) => parseFloat(s.trim()))
                .filter((n) => !isNaN(n) && n > 0);
              onUpdateDisplay({ qValues: vals.length > 0 ? vals : [1] });
            }}
            placeholder="1, 2, 5"
          />
        </div>
      )}

      {/* Export */}
      <div className="border-t border-border pt-3">
        <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
          Export
        </label>
        <button className="smith-btn w-full" onClick={onExportPNG}>
          Export as PNG
        </button>
      </div>
    </div>
  );
}
