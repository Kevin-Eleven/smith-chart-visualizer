import React, { useState } from 'react';
import { Complex, gammaFromZ, s11DbToLinear } from '@/smith/math';
import { rotateGamma, shortStubImpedance, openStubImpedance, yFromZ, zFromY } from '@/smith/math';
import type { SmithState } from '@/smith/state';

type InputFormat = 'Z' | 'gamma' | 'S11' | 'Y';

interface Props {
  state: SmithState;
  onPlotPoint: (gamma: Complex, description: string) => void;
  onNavigate: (gamma: Complex, description: string) => void;
}

export default function InputPanel({ state, onPlotPoint, onNavigate }: Props) {
  const [format, setFormat] = useState<InputFormat>('Z');
  const [zReal, setZReal] = useState('75');
  const [zImag, setZImag] = useState('25');
  const [z0Input, setZ0Input] = useState(state.Z0.toString());
  const [gammaMag, setGammaMag] = useState('0.5');
  const [gammaAng, setGammaAng] = useState('45');
  const [s11Mag, setS11Mag] = useState('-10');
  const [s11Ang, setS11Ang] = useState('30');
  const [yReal, setYReal] = useState('0.02');
  const [yImag, setYImag] = useState('-0.005');
  const [y0Input, setY0Input] = useState('0.02');
  const [moveDistance, setMoveDistance] = useState('0.15');
  const [stubLength, setStubLength] = useState('0.125');
  const [stubType, setStubType] = useState<'open' | 'short'>('open');

  const activePoint = state.points.find(p => p.id === state.activePointId);

  const handlePlot = () => {
    let gamma: Complex;
    let desc: string;
    const Z0 = parseFloat(z0Input) || state.Z0;

    switch (format) {
      case 'Z': {
        const zr = parseFloat(zReal) || 0;
        const zi = parseFloat(zImag) || 0;
        const zn = new Complex(zr / Z0, zi / Z0);
        gamma = gammaFromZ(zn);
        desc = `Plotted Z = ${zr} ${zi >= 0 ? '+' : '-'} j${Math.abs(zi)} Ω (Z₀ = ${Z0} Ω)`;
        break;
      }
      case 'gamma': {
        const mag = parseFloat(gammaMag) || 0;
        const ang = parseFloat(gammaAng) || 0;
        gamma = Complex.fromPolar(Math.min(mag, 0.999), ang);
        desc = `Plotted Γ = ${mag.toFixed(3)}∠${ang.toFixed(1)}°`;
        break;
      }
      case 'S11': {
        const db = parseFloat(s11Mag) || 0;
        const ang = parseFloat(s11Ang) || 0;
        const mag = s11DbToLinear(db);
        gamma = Complex.fromPolar(Math.min(mag, 0.999), ang);
        desc = `Plotted S₁₁ = ${db} dB ∠${ang}° → |Γ| = ${mag.toFixed(3)}`;
        break;
      }
      case 'Y': {
        const yr = parseFloat(yReal) || 0;
        const yi = parseFloat(yImag) || 0;
        const Y0 = parseFloat(y0Input) || (1 / state.Z0);
        const yn = new Complex(yr / Y0, yi / Y0);
        const zn = zFromY(yn);
        gamma = gammaFromZ(zn);
        desc = `Plotted Y = ${yr} ${yi >= 0 ? '+' : '-'} j${Math.abs(yi)} S (Y₀ = ${Y0} S)`;
        break;
      }
    }

    onPlotPoint(gamma!, desc!);
  };

  const handleMoveGen = () => {
    if (!activePoint) return;
    const d = parseFloat(moveDistance) || 0;
    const g = new Complex(activePoint.gamma.re, activePoint.gamma.im);
    const newGamma = rotateGamma(g, d);
    onNavigate(newGamma, `Moved ${d.toFixed(3)}λ toward generator`);
  };

  const handleMoveLoad = () => {
    if (!activePoint) return;
    const d = parseFloat(moveDistance) || 0;
    const g = new Complex(activePoint.gamma.re, activePoint.gamma.im);
    const newGamma = rotateGamma(g, -d);
    onNavigate(newGamma, `Moved ${d.toFixed(3)}λ toward load`);
  };

  const handleShuntStub = () => {
    if (!activePoint) return;
    const l = parseFloat(stubLength) || 0;
    const g = new Complex(activePoint.gamma.re, activePoint.gamma.im);
    // Get current admittance
    const zn = new Complex(1).add(g).div(new Complex(1).sub(g));
    const yn = yFromZ(zn);
    // Stub admittance
    const stubZ = stubType === 'open' ? openStubImpedance(l) : shortStubImpedance(l);
    const stubY = yFromZ(stubZ);
    // Add in shunt (add admittances)
    const newY = yn.add(stubY);
    const newZ = zFromY(newY);
    const newGamma = gammaFromZ(newZ);
    onNavigate(newGamma, `Added shunt ${stubType} stub (l = ${l.toFixed(3)}λ) → ΔB = ${stubY.im >= 0 ? '+' : ''}${stubY.im.toFixed(3)}`);
  };

  const handleSeriesStub = () => {
    if (!activePoint) return;
    const l = parseFloat(stubLength) || 0;
    const g = new Complex(activePoint.gamma.re, activePoint.gamma.im);
    const zn = new Complex(1).add(g).div(new Complex(1).sub(g));
    const stubZ = stubType === 'open' ? openStubImpedance(l) : shortStubImpedance(l);
    const newZ = zn.add(stubZ);
    const newGamma = gammaFromZ(newZ);
    onNavigate(newGamma, `Added series ${stubType} stub (l = ${l.toFixed(3)}λ) → ΔX = ${stubZ.im >= 0 ? '+' : ''}${stubZ.im.toFixed(3)}`);
  };

  const radioClass = (active: boolean) =>
    `px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
      active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
    }`;

  return (
    <div className="p-3 space-y-4 text-sm">
      {/* Format selector */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">Input Format</label>
        <div className="flex gap-1 flex-wrap">
          {([['Z', 'Impedance'], ['gamma', 'Γ Polar'], ['S11', 'S₁₁ (dB)'], ['Y', 'Admittance']] as const).map(([key, label]) => (
            <button key={key} className={radioClass(format === key)} onClick={() => setFormat(key as InputFormat)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Input fields */}
      <div className="space-y-2">
        {format === 'Z' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">R (Ω)</label>
                <input className="smith-input w-full" value={zReal} onChange={e => setZReal(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">X (Ω)</label>
                <input className="smith-input w-full" value={zImag} onChange={e => setZImag(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">Z₀ (Ω)</label>
              <input className="smith-input w-full" value={z0Input} onChange={e => setZ0Input(e.target.value)} />
            </div>
          </>
        )}
        {format === 'gamma' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">|Γ|</label>
              <input className="smith-input w-full" value={gammaMag} onChange={e => setGammaMag(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">∠Γ (°)</label>
              <input className="smith-input w-full" value={gammaAng} onChange={e => setGammaAng(e.target.value)} />
            </div>
          </div>
        )}
        {format === 'S11' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">|S₁₁| (dB)</label>
              <input className="smith-input w-full" value={s11Mag} onChange={e => setS11Mag(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">∠S₁₁ (°)</label>
              <input className="smith-input w-full" value={s11Ang} onChange={e => setS11Ang(e.target.value)} />
            </div>
          </div>
        )}
        {format === 'Y' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">G (S)</label>
                <input className="smith-input w-full" value={yReal} onChange={e => setYReal(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-0.5">B (S)</label>
                <input className="smith-input w-full" value={yImag} onChange={e => setYImag(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-0.5">Y₀ (S)</label>
              <input className="smith-input w-full" value={y0Input} onChange={e => setY0Input(e.target.value)} />
            </div>
          </>
        )}
      </div>

      <button className="smith-btn w-full" onClick={handlePlot}>Plot Point</button>

      {/* Navigation */}
      <div className="border-t border-border pt-3 space-y-2">
        <label className="block text-xs text-muted-foreground font-medium uppercase tracking-wider">Navigation {!activePoint && <span className="text-destructive">(select a point first)</span>}</label>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-0.5">Distance (λ)</label>
            <input className="smith-input w-full" value={moveDistance} onChange={e => setMoveDistance(e.target.value)} />
          </div>
          <button className="smith-btn-secondary text-xs whitespace-nowrap" onClick={handleMoveGen} disabled={!activePoint}>→ Gen</button>
          <button className="smith-btn-secondary text-xs whitespace-nowrap" onClick={handleMoveLoad} disabled={!activePoint}>→ Load</button>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-0.5">Stub (λ)</label>
            <input className="smith-input w-full" value={stubLength} onChange={e => setStubLength(e.target.value)} />
          </div>
          <select className="smith-input py-1.5" value={stubType} onChange={e => setStubType(e.target.value as 'open' | 'short')}>
            <option value="open">Open</option>
            <option value="short">Short</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="smith-btn-secondary text-xs flex-1" onClick={handleShuntStub} disabled={!activePoint}>+ Shunt Stub</button>
          <button className="smith-btn-secondary text-xs flex-1" onClick={handleSeriesStub} disabled={!activePoint}>+ Series Stub</button>
        </div>
      </div>
    </div>
  );
}
