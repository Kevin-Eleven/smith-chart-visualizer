import React from 'react';
import { Complex } from '@/smith/math';
import { getPointInfo } from '@/smith/state';
import type { SmithState, SmithPoint } from '@/smith/state';

interface Props {
  state: SmithState;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export default function PointsPanel({ state, onSelect, onDelete, onRename }: Props) {
  if (state.points.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <p className="mb-1">No points plotted yet.</p>
        <p className="text-xs">Click on the chart or use the Input tab to add points.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto text-xs">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-2 py-1.5 text-left font-medium">Label</th>
            <th className="px-2 py-1.5 text-left font-medium">Z (norm)</th>
            <th className="px-2 py-1.5 text-left font-medium">Γ</th>
            <th className="px-2 py-1.5 text-left font-medium">VSWR</th>
            <th className="px-2 py-1.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {state.points.map(point => {
            const gamma = new Complex(point.gamma.re, point.gamma.im);
            const info = getPointInfo(gamma, state.Z0);
            const isActive = point.id === state.activePointId;

            return (
              <tr
                key={point.id}
                className={`border-b border-border cursor-pointer transition-colors ${isActive ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                onClick={() => onSelect(point.id)}
              >
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: point.color }} />
                    <span className="smith-mono font-medium">{point.label}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 smith-mono">
                  {info.zNorm.re.toFixed(2)}{info.zNorm.im >= 0 ? '+' : ''}{info.zNorm.im.toFixed(2)}j
                </td>
                <td className="px-2 py-1.5 smith-mono">
                  {info.gammaMag.toFixed(3)}∠{info.gammaAngle.toFixed(1)}°
                </td>
                <td className="px-2 py-1.5 smith-mono">{info.vswr.toFixed(2)}</td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    className="text-muted-foreground hover:text-destructive px-1"
                    onClick={e => { e.stopPropagation(); onDelete(point.id); }}
                    title="Delete"
                  >✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
