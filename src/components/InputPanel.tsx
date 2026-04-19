import React, { useEffect, useState } from "react";
import { Complex, gammaFromZ, s11DbToLinear } from "@/smith/math";
import { rotateGamma, zFromY } from "@/smith/math";
import { getPointInfo, type SmithState } from "@/smith/state";

type InputFormat = "Z" | "gamma" | "S11" | "Y";

interface Props {
  state: SmithState;
  onPlotPoint: (gamma: Complex, description: string, z0: number) => void;
  onNavigate: (gamma: Complex, description: string, z0: number) => void;
}

export default function InputPanel({ state, onPlotPoint, onNavigate }: Props) {
  const [format, setFormat] = useState<InputFormat>("Z");
  const [zReal, setZReal] = useState("0.4");
  const [zImag, setZImag] = useState("0.6");
  const [z0Input, setZ0Input] = useState(state.Z0.toString());
  const [gammaMag, setGammaMag] = useState("0.5");
  const [gammaAng, setGammaAng] = useState("45");
  const [s11Mag, setS11Mag] = useState("-10");
  const [s11Ang, setS11Ang] = useState("30");
  const [yReal, setYReal] = useState("0.02");
  const [yImag, setYImag] = useState("-0.005");
  const [y0Input, setY0Input] = useState("0.02");
  const [moveDistance, setMoveDistance] = useState("0.15");

  const activePoint = state.points.find((p) => p.id === state.activePointId);

  useEffect(() => {
    if (!activePoint) return;

    const pointZ0 = activePoint.z0 || state.Z0;
    const gamma = new Complex(activePoint.gamma.re, activePoint.gamma.im);
    const info = getPointInfo(gamma, pointZ0);
    const gammaMagValue = info.gammaMag;
    const y0 = pointZ0 !== 0 ? 1 / pointZ0 : 0;
    const s11Db = gammaMagValue > 0 ? 20 * Math.log10(gammaMagValue) : -120;

    setZReal(info.z.re.toFixed(4));
    setZImag(info.z.im.toFixed(4));
    setZ0Input(pointZ0.toString());

    setGammaMag(gammaMagValue.toFixed(6));
    setGammaAng(info.gammaAngle.toFixed(3));

    setS11Mag(s11Db.toFixed(3));
    setS11Ang(info.gammaAngle.toFixed(3));

    setYReal(info.y.re.toFixed(6));
    setYImag(info.y.im.toFixed(6));
    setY0Input(y0.toString());
  }, [activePoint, state.Z0]);

  const handlePlot = () => {
    let gamma: Complex;
    let desc: string;
    const Z0 = parseFloat(z0Input) || state.Z0;

    switch (format) {
      case "Z": {
        const zr = parseFloat(zReal) || 0;
        const zi = parseFloat(zImag) || 0;
        const zn = new Complex(zr / Z0, zi / Z0);
        gamma = gammaFromZ(zn);
        desc = `Plotted Z = ${zr} ${zi >= 0 ? "+" : "-"} j${Math.abs(zi)} Ω (Z₀ = ${Z0} Ω)`;
        onPlotPoint(gamma, desc, Z0);
        break;
      }
      case "gamma": {
        const mag = parseFloat(gammaMag) || 0;
        const ang = parseFloat(gammaAng) || 0;
        gamma = Complex.fromPolar(Math.min(mag, 0.999), ang);
        desc = `Plotted Γ = ${mag.toFixed(3)}∠${ang.toFixed(1)}°`;
        onPlotPoint(gamma, desc, state.Z0);
        break;
      }
      case "S11": {
        const db = parseFloat(s11Mag) || 0;
        const ang = parseFloat(s11Ang) || 0;
        const mag = s11DbToLinear(db);
        gamma = Complex.fromPolar(Math.min(mag, 0.999), ang);
        desc = `Plotted S₁₁ = ${db} dB ∠${ang}° → |Γ| = ${mag.toFixed(3)}`;
        onPlotPoint(gamma, desc, state.Z0);
        break;
      }
      case "Y": {
        const yr = parseFloat(yReal) || 0;
        const yi = parseFloat(yImag) || 0;
        const Y0 = parseFloat(y0Input) || 1 / state.Z0;
        const yn = new Complex(yr / Y0, yi / Y0);
        const zn = zFromY(yn);
        gamma = gammaFromZ(zn);
        desc = `Plotted Y = ${yr} ${yi >= 0 ? "+" : "-"} j${Math.abs(yi)} S (Y₀ = ${Y0} S)`;
        onPlotPoint(gamma, desc, Y0 !== 0 ? 1 / Y0 : state.Z0);
        break;
      }
    }
  };

  const handleMoveGen = () => {
    if (!activePoint) return;
    const d = parseFloat(moveDistance) || 0;
    const g = new Complex(activePoint.gamma.re, activePoint.gamma.im);
    const newGamma = rotateGamma(g, d);
    onNavigate(
      newGamma,
      `Moved ${d.toFixed(3)}λ toward generator`,
      activePoint.z0 || state.Z0,
    );
  };

  const handleMoveLoad = () => {
    if (!activePoint) return;
    const d = parseFloat(moveDistance) || 0;
    const g = new Complex(activePoint.gamma.re, activePoint.gamma.im);
    const newGamma = rotateGamma(g, -d);
    onNavigate(
      newGamma,
      `Moved ${d.toFixed(3)}λ toward load`,
      activePoint.z0 || state.Z0,
    );
  };

  const radioClass = (active: boolean) =>
    `px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
    }`;

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* Format selector */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
          Input Format
        </label>
        <div className="flex gap-1 flex-wrap">
          {(
            [
              ["Z", "Impedance"],
              ["gamma", "Γ Polar"],
              ["S11", "S₁₁ (dB)"],
              ["Y", "Admittance"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={radioClass(format === key)}
              onClick={() => setFormat(key as InputFormat)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Input fields */}
      <div className="space-y-2">
        {format === "Z" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">
                  R (Ω)
                </label>
                <input
                  className="smith-input w-full"
                  value={zReal}
                  onChange={(e) => setZReal(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">
                  X (Ω)
                </label>
                <input
                  className="smith-input w-full"
                  value={zImag}
                  onChange={(e) => setZImag(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">
                Z₀ (Ω)
              </label>
              <input
                className="smith-input w-full"
                value={z0Input}
                onChange={(e) => setZ0Input(e.target.value)}
              />
            </div>
          </>
        )}
        {format === "gamma" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">
                |Γ|
              </label>
              <input
                className="smith-input w-full"
                value={gammaMag}
                onChange={(e) => setGammaMag(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">
                ∠Γ (°)
              </label>
              <input
                className="smith-input w-full"
                value={gammaAng}
                onChange={(e) => setGammaAng(e.target.value)}
              />
            </div>
          </div>
        )}
        {format === "S11" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">
                |S₁₁| (dB)
              </label>
              <input
                className="smith-input w-full"
                value={s11Mag}
                onChange={(e) => setS11Mag(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">
                ∠S₁₁ (°)
              </label>
              <input
                className="smith-input w-full"
                value={s11Ang}
                onChange={(e) => setS11Ang(e.target.value)}
              />
            </div>
          </div>
        )}
        {format === "Y" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">
                  G (S)
                </label>
                <input
                  className="smith-input w-full"
                  value={yReal}
                  onChange={(e) => setYReal(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">
                  B (S)
                </label>
                <input
                  className="smith-input w-full"
                  value={yImag}
                  onChange={(e) => setYImag(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">
                Y₀ (S)
              </label>
              <input
                className="smith-input w-full"
                value={y0Input}
                onChange={(e) => setY0Input(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <button className="smith-btn w-full" onClick={handlePlot}>
        Plot Point
      </button>

      {/* Navigation */}
      <div className="border-t border-border pt-3 space-y-2">
        <label className="block text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Navigation{" "}
          {!activePoint && (
            <span className="text-destructive">(select a point first)</span>
          )}
        </label>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-0.5">
              Distance (λ)
            </label>
            <input
              className="smith-input w-full"
              value={moveDistance}
              onChange={(e) => setMoveDistance(e.target.value)}
            />
          </div>
          <button
            className="smith-btn-secondary text-xs whitespace-nowrap"
            onClick={handleMoveGen}
            disabled={!activePoint}
          >
            → Gen
          </button>
          <button
            className="smith-btn-secondary text-xs whitespace-nowrap"
            onClick={handleMoveLoad}
            disabled={!activePoint}
          >
            → Load
          </button>
        </div>
      </div>
    </div>
  );
}
