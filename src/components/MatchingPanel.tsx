import React, { useState, useMemo } from "react";
import {
  Complex,
  zFromGamma,
  yFromZ,
  applySeriesReactance,
  applyShuntSusceptance,
  gammaFromZ,
} from "@/smith/math";
import { getPointInfo } from "@/smith/state";
import type { SmithState, ComponentType, MatchingStep } from "@/smith/state";

interface Props {
  state: SmithState;
  onApplyStep: (component: ComponentType, value: number) => void;
  onUndoStep: () => void;
  onClearMatching: () => void;
}

const COMPONENT_INFO: Record<
  ComponentType,
  {
    label: string;
    symbol: string;
    domain: string;
    direction: string;
    color: string;
  }
> = {
  series_L: {
    label: "Series L",
    symbol: "⌇L",
    domain: "Impedance",
    direction: "CW",
    color: "#16a34a",
  },
  series_C: {
    label: "Series C",
    symbol: "⌇C",
    domain: "Impedance",
    direction: "CCW",
    color: "#2563eb",
  },
  shunt_L: {
    label: "Shunt L",
    symbol: "⏚L",
    domain: "Admittance",
    direction: "CCW",
    color: "#d97706",
  },
  shunt_C: {
    label: "Shunt C",
    symbol: "⏚C",
    domain: "Admittance",
    direction: "CW",
    color: "#8b5cf6",
  },
};

export default function MatchingPanel({
  state,
  onApplyStep,
  onUndoStep,
  onClearMatching,
}: Props) {
  const [component, setComponent] = useState<ComponentType>("series_L");
  const [valueInput, setValueInput] = useState("0.5");

  const activePoint = state.points.find((p) => p.id === state.activePointId);
  const value = parseFloat(valueInput) || 0;
  const info = COMPONENT_INFO[component];

  // Compute the signed delta value from the component type and magnitude
  const signedValue = useMemo(() => {
    switch (component) {
      case "series_L":
        return value; // +jX
      case "series_C":
        return -value; // -jX
      case "shunt_L":
        return -value; // -jB
      case "shunt_C":
        return value; // +jB
    }
  }, [component, value]);

  // Live preview of the result
  const preview = useMemo(() => {
    if (!activePoint || value === 0) return null;
    const pointZ0 = activePoint.z0 || state.Z0;
    const gamma = new Complex(activePoint.gamma.re, activePoint.gamma.im);
    const zBeforeNorm = zFromGamma(gamma);
    const yBeforeNorm = yFromZ(zBeforeNorm);
    const zBefore = new Complex(
      zBeforeNorm.re * pointZ0,
      zBeforeNorm.im * pointZ0,
    );
    const yBefore = new Complex(
      yBeforeNorm.re / pointZ0,
      yBeforeNorm.im / pointZ0,
    );

    let newGamma: Complex;
    if (component === "series_L" || component === "series_C") {
      newGamma = applySeriesReactance(gamma, signedValue);
    } else {
      newGamma = applyShuntSusceptance(gamma, signedValue);
    }

    const zAfterNorm = zFromGamma(newGamma);
    const yAfterNorm = yFromZ(zAfterNorm);
    const zAfter = new Complex(
      zAfterNorm.re * pointZ0,
      zAfterNorm.im * pointZ0,
    );
    const yAfter = new Complex(
      yAfterNorm.re / pointZ0,
      yAfterNorm.im / pointZ0,
    );
    const infoAfter = getPointInfo(newGamma, pointZ0);

    return {
      zBefore,
      yBefore,
      zAfter,
      yAfter,
      newGamma,
      vswr: infoAfter.vswr,
      returnLoss: infoAfter.returnLoss,
    };
  }, [activePoint, component, signedValue, value, state.Z0]);

  const handleApply = () => {
    if (!activePoint || value === 0) return;
    onApplyStep(component, value);
  };

  const isSeriesType = component === "series_L" || component === "series_C";
  const valueLabel = isSeriesType
    ? "Reactance X (norm)"
    : "Susceptance B (norm)";
  const deltaLabel = isSeriesType
    ? `${signedValue >= 0 ? "+" : ""}j${signedValue.toFixed(3)}`
    : `${signedValue >= 0 ? "+" : ""}j${signedValue.toFixed(3)}`;

  const fmtC = (c: Complex) => {
    const sign = c.im >= 0 ? "+" : "-";
    return `${c.re.toFixed(3)} ${sign} j${Math.abs(c.im).toFixed(3)}`;
  };

  const radioClass = (active: boolean) =>
    `px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer transition-all duration-150 border ${
      active
        ? "bg-primary text-primary-foreground border-primary shadow-sm"
        : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
    }`;

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* Component type selector */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
          Component Type
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(COMPONENT_INFO) as ComponentType[]).map((type) => (
            <button
              key={type}
              className={radioClass(component === type)}
              onClick={() => setComponent(type)}
            >
              <span className="mr-1">{COMPONENT_INFO[type].symbol}</span>
              {COMPONENT_INFO[type].label}
            </button>
          ))}
        </div>
      </div>

      {/* Component info badge */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-2.5 py-1.5">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: info.color }}
        />
        <span>{info.domain} domain</span>
        <span className="text-muted-foreground/50">|</span>
        <span>{info.direction === "CW" ? "↻ Clockwise" : "↺ Counter-CW"}</span>
        <span className="text-muted-foreground/50">|</span>
        <span>Const {isSeriesType ? "r" : "g"}</span>
      </div>

      {/* Value input */}
      <div>
        <label className="block text-xs text-muted-foreground mb-0.5 font-medium">
          {valueLabel}
        </label>
        <div className="flex gap-2 items-center">
          <input
            className="smith-input flex-1"
            type="number"
            step="0.1"
            min="0"
            value={valueInput}
            onChange={(e) => setValueInput(e.target.value)}
          />
          <span className="text-xs smith-mono text-muted-foreground whitespace-nowrap">
            Δ = {deltaLabel}
          </span>
        </div>
      </div>

      {/* Apply button */}
      <button
        className="smith-btn w-full"
        onClick={handleApply}
        disabled={!activePoint || value === 0}
      >
        {!activePoint
          ? "Select a point first"
          : value === 0
            ? "Enter a value"
            : `Apply ${info.label}`}
      </button>

      {/* Live preview */}
      {preview && activePoint && (
        <div className="bg-muted/30 rounded-md p-2.5 space-y-1.5 border border-border">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Preview
          </div>
          {isSeriesType ? (
            <>
              <div className="text-xs smith-mono">
                <span className="text-muted-foreground">z:</span>{" "}
                {fmtC(preview.zBefore)} → {fmtC(preview.zAfter)}
              </div>
              <div className="text-xs smith-mono text-muted-foreground">
                r = {preview.zBefore.re.toFixed(3)} Ω (constant)
              </div>
            </>
          ) : (
            <>
              <div className="text-xs smith-mono">
                <span className="text-muted-foreground">y:</span>{" "}
                {fmtC(preview.yBefore)} → {fmtC(preview.yAfter)}
              </div>
              <div className="text-xs smith-mono text-muted-foreground">
                g = {preview.yBefore.re.toFixed(3)} (constant)
              </div>
            </>
          )}
          <div className="text-xs smith-mono">
            <span className="text-muted-foreground">VSWR:</span>{" "}
            {preview.vswr.toFixed(2)}
            <span className="text-muted-foreground ml-2">RL:</span>{" "}
            {isFinite(preview.returnLoss) ? preview.returnLoss.toFixed(1) : "∞"}{" "}
            dB
          </div>
        </div>
      )}

      {/* Matching steps list */}
      {state.matchingSteps.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Matching Network ({state.matchingSteps.length} step
              {state.matchingSteps.length !== 1 ? "s" : ""})
            </label>
            <div className="flex gap-1">
              <button
                className="smith-btn-ghost text-xs px-2 py-0.5"
                onClick={onUndoStep}
              >
                ↶ Undo
              </button>
              <button
                className="smith-btn-ghost text-xs px-2 py-0.5 text-destructive hover:text-destructive"
                onClick={onClearMatching}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {state.matchingSteps.map((step, i) => {
              const stepInfo = COMPONENT_INFO[step.component];
              const isShunt =
                step.component === "shunt_L" || step.component === "shunt_C";
              return (
                <div
                  key={step.id}
                  className="flex items-center gap-2 text-xs smith-mono bg-muted/30 rounded px-2 py-1.5 border border-border/50"
                >
                  <span className="text-muted-foreground font-medium">
                    {i + 1}.
                  </span>
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stepInfo.color }}
                  />
                  <span className="font-medium">{stepInfo.label}</span>
                  <span className="text-muted-foreground">
                    {isShunt ? "ΔB" : "ΔX"} = {step.value >= 0 ? "+" : ""}
                    {step.value.toFixed(3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
