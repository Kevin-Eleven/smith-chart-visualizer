import React from 'react';
import type { getPointInfo } from '@/smith/state';

interface Props {
  info: ReturnType<typeof getPointInfo> | null;
  Z0: number;
}

export default function StatusBar({ info, Z0 }: Props) {
  if (!info) {
    return (
      <div className="smith-status-bar px-4 py-1.5 flex items-center gap-6 text-xs smith-mono">
        <span className="text-muted-foreground">Hover over the chart to see values</span>
      </div>
    );
  }

  const fmtC = (c: { re: number; im: number }, unit: string) => {
    const sign = c.im >= 0 ? '+' : '-';
    return `${c.re.toFixed(2)} ${sign} j${Math.abs(c.im).toFixed(2)} ${unit}`;
  };

  return (
    <div className="smith-status-bar px-4 py-1.5 flex items-center gap-4 text-xs smith-mono flex-wrap">
      <span>
        <span className="smith-status-accent">Z</span> = {fmtC(info.z, 'Ω')}
      </span>
      <span>
        <span className="smith-status-accent">Y</span> = {fmtC(info.y, 'S')}
      </span>
      <span>
        <span className="smith-status-accent">Γ</span> = {info.gammaMag.toFixed(3)}∠{info.gammaAngle.toFixed(1)}°
      </span>
      <span>
        <span className="smith-status-accent">VSWR</span> = {info.vswr.toFixed(2)}
      </span>
      <span>
        <span className="smith-status-accent">RL</span> = {isFinite(info.returnLoss) ? info.returnLoss.toFixed(1) : '∞'} dB
      </span>
      <span>
        <span className="smith-status-accent">WTG</span> = {info.wtg.toFixed(3)}λ
      </span>
      <span>
        <span className="smith-status-accent">WTL</span> = {info.wtl.toFixed(3)}λ
      </span>
    </div>
  );
}
